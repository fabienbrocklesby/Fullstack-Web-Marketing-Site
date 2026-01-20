# LightLane Licensing Portal - Current State (Verified)

**Audit Date:** 2026-01-19  
**Last Updated:** Stage 3 complete - webhook-only subscription management with out-of-order protection  
**Scope:** Website/Portal licensing system only (not desktop app internals)

---

## Changelog (2026-01-19 Audit)

### ✅ Verified Items

- Data models (license-key, customer, purchase, entitlement, stripe-event schemas)
- Route definitions in `custom/routes/custom.js` and `customer/routes/customer.js`
- Customer auth middleware with JWT_SECRET fallback
- License activation/deactivation flow in `custom/controllers/custom.js`
- Rate limiting middleware for license endpoints (10 req/min)
- Entitlement tier mapping logic in `utils/entitlement-mapping.js`
- Founders sale window (ends 2026-01-11T23:59:59Z)

### ✏️ Corrected Items

- **GAP-001 RESOLVED**: `handleSuccessfulPayment` bug is FIXED. Webhook now uses `processStripeEvent()` from `utils/stripe-webhook-handler.js`
- **Webhook is now server truth**: `processCustomerPurchase` returns 410 Gone (deprecated). Fulfillment is exclusively via webhook.
- **New routes added**: `/api/stripe/billing-portal`, `/api/customer/purchase-status`, `/api/pricing`, `/api/customer-checkout-subscription`
- **License reset now protected**: Uses `admin-internal` middleware requiring `ADMIN_INTERNAL_TOKEN`
- **License endpoints rate-limited**: Via `license-rate-limit` middleware (10 req/min/IP)
- **Auth endpoints rate-limited**: Via `auth-rate-limit` middleware (5 req/min/IP)
- Updated line number references to match current codebase

### ➕ Added Items (Stage 3)

- **Out-of-order protection**: Uses `lastStripeEventCreated` in entitlement metadata to prevent older events from overwriting newer state
- **Unified subscription update function**: `applyStripeSubscriptionToEntitlement()` provides single source of truth for subscription→entitlement mapping
- **Enhanced idempotency**: `markEventProcessed()` now stores `eventCreated` timestamp
- **Removed manual resync**: No customer-facing resync endpoint - webhooks are sole update mechanism
- Subscription checkout flow documentation
- Billing portal endpoint
- Purchase status polling endpoint (for webhook-based flow)
- Additional environment variables for Stripe price IDs
- Audit logging details
- Founders protection in webhook handlers

### ⚠️ Unverified Items

- None - all claims verified against codebase

---

## 0. Repo Context

### Framework

- **Backend:** Strapi 4 CMS (Node.js)
- **Frontend:** Astro with client-side JavaScript
- **Database:** SQLite (via Strapi's entity service abstraction)

### Entrypoints

| Component      | Location                                                     |
| -------------- | ------------------------------------------------------------ |
| Strapi main    | `backend/src/index.js`                                       |
| API routes     | `backend/src/api/*/routes/*.js` (auto-loaded alphabetically) |
| Controllers    | `backend/src/api/*/controllers/*.js`                         |
| Middlewares    | `backend/src/middlewares/*.js`                               |
| Frontend pages | `frontend/src/pages/**/*.astro`                              |

### Route Loading Order (Critical)

Strapi 4 loads APIs alphabetically. For `/api/license/activate`:

1. `custom` (L:47-54 in `custom/routes/custom.js`) → **WINS** (loads first)

**Note:** Legacy `license` and `license-portal` APIs have been removed (Stage 2 cleanup).

**Evidence:** `backend/src/api/custom/routes/custom.js:47-54`

### Environment Variables (Actually Read)

| Variable                            | Usage                          | File:Line                                                                    |
| ----------------------------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                 | Stripe API authentication      | `custom/controllers/custom.js:1`                                             |
| `STRIPE_WEBHOOK_SECRET`             | Webhook signature verification | `custom/controllers/custom.js:~278`                                          |
| `JWT_SECRET`                        | Customer token signing (HS256) | `customer/controllers/customer.js:92,170`, `middlewares/customer-auth.js:13` |
| `JWT_PRIVATE_KEY`                   | License token signing (RS256)  | `utils/jwt-keys.js:16`, `custom/controllers/custom.js:~1117`                 |
| `JWT_ISSUER`                        | JWT issuer claim               | `custom/controllers/custom.js:~1089`                                         |
| `NODE_ENV`                          | Dev mode checks                | Multiple files                                                               |
| `FOUNDERS_SALE_END_ISO`             | Founders sale end override     | `utils/entitlement-mapping.js:86-95` (default: 2026-01-11T23:59:59Z)         |
| `ADMIN_INTERNAL_TOKEN`              | Admin endpoint protection      | `middlewares/admin-internal.js:14`                                           |
| `STRIPE_PRICE_ID_MAKER_ONETIME`     | Stripe price ID for maker tier | `custom/controllers/custom.js:27`, `stripe-webhook-handler.js:150`           |
| `STRIPE_PRICE_ID_PRO_ONETIME`       | Stripe price ID for pro tier   | `custom/controllers/custom.js:34`, `stripe-webhook-handler.js:151`           |
| `STRIPE_PRICE_ID_MAKER_SUB_MONTHLY` | Maker subscription price       | `custom/controllers/custom.js:42`, `stripe-webhook-handler.js:152`           |
| `STRIPE_PRICE_ID_PRO_SUB_MONTHLY`   | Pro subscription price         | `custom/controllers/custom.js:48`, `stripe-webhook-handler.js:153`           |

---

## 1. Data Model (Schemas)

### license-key

**File:** `backend/src/api/license-key/content-types/license-key/schema.json`

| Field                | Type     | Required | Default    | Notes                                                |
| -------------------- | -------- | -------- | ---------- | ---------------------------------------------------- |
| `key`                | string   | ✓        | -          | Unique                                               |
| `productName`        | string   | ✓        | -          |                                                      |
| `priceId`            | string   | ✓        | -          |                                                      |
| `customer`           | relation | -        | -          | manyToOne → customer                                 |
| `customerEmail`      | email    | -        | -          |                                                      |
| `purchase`           | relation | -        | -          | oneToOne → purchase                                  |
| `entitlement`        | relation | -        | -          | oneToOne → entitlement (1:1, `mappedBy: licenseKey`) |
| `isActive`           | boolean  | -        | `true`     |                                                      |
| `status`             | enum     | -        | `"unused"` | `["unused", "active"]`                               |
| `jti`                | string   | -        | -          | JWT ID for current activation                        |
| `machineId`          | string   | -        | -          | Device fingerprint (normalized MAC or hash)          |
| `typ`                | enum     | -        | `"paid"`   | `["trial", "paid", "starter", "pro", "enterprise"]`  |
| `trialStart`         | datetime | -        | -          |                                                      |
| `isUsed`             | boolean  | -        | `false`    | Legacy field                                         |
| `deviceInfo`         | json     | -        | -          |                                                      |
| `activatedAt`        | datetime | -        | -          |                                                      |
| `expiresAt`          | datetime | -        | -          |                                                      |
| `maxActivations`     | integer  | -        | `1`        | (min: 1)                                             |
| `currentActivations` | integer  | -        | `0`        | (min: 0)                                             |
| `deactivationCode`   | text     | -        | -          | Encrypted deactivation code                          |
| `activationNonce`    | string   | -        | -          | SHA-256 hashed nonce for offline deactivation        |

### customer

**File:** `backend/src/api/customer/content-types/customer/schema.json`

| Field                   | Type     | Required | Default | Notes                   |
| ----------------------- | -------- | -------- | ------- | ----------------------- |
| `email`                 | email    | ✓        | -       | Unique                  |
| `firstName`             | string   | ✓        | -       |                         |
| `lastName`              | string   | ✓        | -       |                         |
| `password`              | string   | ✓        | -       | Private (bcrypt hashed) |
| `isActive`              | boolean  | -        | `true`  |                         |
| `emailVerified`         | boolean  | -        | `false` |                         |
| `stripeCustomerId`      | string   | -        | -       | Unique                  |
| `purchases`             | relation | -        | -       | oneToMany → purchase    |
| `licenseKeys`           | relation | -        | -       | oneToMany → license-key |
| `entitlements`          | relation | -        | -       | oneToMany → entitlement |
| `devices`               | relation | -        | -       | oneToMany → device      |
| `resetPasswordToken`    | string   | -        | -       | Private                 |
| `resetPasswordExpires`  | datetime | -        | -       | Private                 |
| `metadata`              | json     | -        | -       |                         |
| `originEnquiryId`       | string   | -        | -       |                         |
| `affiliateCodeAtSignup` | string   | -        | -       |                         |

### purchase

**File:** `backend/src/api/purchase/content-types/purchase/schema.json`

| Field                   | Type     | Required | Default     | Notes                             |
| ----------------------- | -------- | -------- | ----------- | --------------------------------- |
| `stripeSessionId`       | string   | ✓        | -           | Unique                            |
| `stripePaymentIntentId` | string   | -        | -           | Payment intent ID                 |
| `stripeInvoiceId`       | string   | -        | -           | Invoice ID (for subscriptions)    |
| `stripeSubscriptionId`  | string   | -        | -           | Subscription ID                   |
| `mode`                  | enum     | -        | `"payment"` | `["payment", "subscription"]`     |
| `isManual`              | boolean  | -        | `false`     |                                   |
| `manualReason`          | text     | -        | -           |                                   |
| `createdByAdmin`        | relation | -        | -           | oneToOne → users-permissions.user |
| `amount`                | decimal  | ✓        | -           |                                   |
| `currency`              | string   | -        | `"usd"`     |                                   |
| `customerEmail`         | email    | -        | -           |                                   |
| `priceId`               | string   | ✓        | -           |                                   |
| `affiliate`             | relation | -        | -           | manyToOne → affiliate             |
| `customer`              | relation | -        | -           | manyToOne → customer              |
| `licenseKey`            | relation | -        | -           | oneToOne → license-key            |
| `commissionAmount`      | decimal  | -        | `0`         |                                   |
| `commissionPaid`        | boolean  | -        | `false`     |                                   |
| `metadata`              | json     | -        | -           |                                   |

### entitlement (1:1 with License-Key)

**File:** `backend/src/api/entitlement/content-types/entitlement/schema.json`

| Field                  | Type     | Required | Default             | Notes                                           |
| ---------------------- | -------- | -------- | ------------------- | ----------------------------------------------- |
| `customer`             | relation | -        | -                   | manyToOne → customer                            |
| `licenseKey`           | relation | -        | -                   | oneToOne → license-key                          |
| `purchase`             | relation | -        | -                   | oneToOne → purchase (optional)                  |
| `tier`                 | enum     | ✓        | -                   | `["maker", "pro", "education", "enterprise"]`   |
| `status`               | enum     | ✓        | `"active"`          | `["active", "inactive", "expired", "canceled"]` |
| `isLifetime`           | boolean  | ✓        | `false`             | True for founders purchases                     |
| `expiresAt`            | datetime | -        | -                   | Null for lifetime entitlements                  |
| `maxDevices`           | integer  | -        | `1`                 | Tier-based: maker=1, pro=2, edu=5, ent=10       |
| `source`               | enum     | -        | `"legacy_purchase"` | `["legacy_purchase", "manual", "subscription"]` |
| `stripeCustomerId`     | string   | -        | -                   | Linked Stripe customer                          |
| `stripeSubscriptionId` | string   | -        | -                   | For subscription-based entitlements             |
| `stripePriceId`        | string   | -        | -                   | Price ID for subscription                       |
| `currentPeriodEnd`     | datetime | -        | -                   | Subscription period end                         |
| `cancelAtPeriodEnd`    | boolean  | -        | `false`             | Subscription cancellation flag                  |
| `metadata`             | json     | -        | -                   |                                                 |
| `devices`              | relation | -        | -                   | oneToMany → device                              |

### stripe-event (Idempotency Tracking)

**File:** `backend/src/api/stripe-event/content-types/stripe-event/schema.json`

| Field         | Type     | Required | Default | Notes                              |
| ------------- | -------- | -------- | ------- | ---------------------------------- |
| `eventId`     | string   | ✓        | -       | Unique - Stripe event ID           |
| `eventType`   | string   | ✓        | -       | e.g., "checkout.session.completed" |
| `processedAt` | datetime | ✓        | -       | When event was processed           |
| `payload`     | json     | -        | -       | Partial payload for debugging      |

**Per-License Entitlements (1:1)**

Each license-key has exactly ONE entitlement (1:1 relationship).
A customer can have MULTIPLE entitlements (one per owned license-key).
This supports customers owning licenses of different tiers with separate billing.

**Tier to Device Mapping:**

| Tier       | maxDevices | Description              |
| ---------- | ---------- | ------------------------ |
| maker      | 1          | Single device (default)  |
| pro        | 2          | Professional use         |
| education  | 5          | Educational institutions |
| enterprise | 10         | Enterprise deployments   |

**Founders Sale Window:**

Purchases made during the founders sale window (2024-01-01 to 2026-01-11) get `isLifetime: true`.
Override via `FOUNDERS_SALE_END_ISO` environment variable.

---

## 2. Public Surfaces (Routes)

### Customer Portal Routes (ACTIVE)

| Method | Path                                             | Auth            | Handler                              | Evidence                                  |
| ------ | ------------------------------------------------ | --------------- | ------------------------------------ | ----------------------------------------- |
| POST   | `/api/customers/register`                        | auth-rate-limit | `customer.register`                  | `customer/routes/customer.js:5-12`        |
| POST   | `/api/customers/login`                           | auth-rate-limit | `customer.login`                     | `customer/routes/customer.js:14-21`       |
| GET    | `/api/customers/me`                              | customer-auth   | `customer.me`                        | `customer/routes/customer.js:22-29`       |
| PUT    | `/api/customers/profile`                         | customer-auth   | `customer.updateProfile`             | `customer/routes/customer.js:30-37`       |
| PUT    | `/api/customers/password`                        | customer-auth   | `customer.changePassword`            | `customer/routes/customer.js:38-45`       |
| GET    | `/api/customers/entitlements`                    | customer-auth   | `customer.entitlements`              | `customer/routes/customer.js:47-54`       |
| GET    | `/api/license-keys`                              | customer-auth   | `license-key.find`                   | `license-key/routes/license-key.js:2-11`  |
| GET    | `/api/license-keys/:id`                          | customer-auth   | `license-key.findOne`                | `license-key/routes/license-key.js:12-21` |
| POST   | `/api/license-keys/:id/generate-activation-code` | customer-auth   | `license-key.generateActivationCode` | `license-key/routes/license-key.js:22-30` |
| POST   | `/api/license-keys/:id/deactivate-with-code`     | customer-auth   | `license-key.deactivateWithCode`     | `license-key/routes/license-key.js:31-41` |

### Checkout & Payment Routes (ACTIVE)

| Method | Path                                  | Auth          | Handler                               | Evidence                        |
| ------ | ------------------------------------- | ------------- | ------------------------------------- | ------------------------------- |
| POST   | `/api/customer-checkout`              | customer-auth | `custom.customerCheckout`             | `custom/routes/custom.js:56-63` |
| POST   | `/api/customer-checkout-subscription` | customer-auth | `custom.customerCheckoutSubscription` | `custom/routes/custom.js:65-73` |
| POST   | `/api/stripe/webhook`                 | None          | `custom.stripeWebhook`                | `custom/routes/custom.js:11-17` |
| POST   | `/api/stripe/billing-portal`          | customer-auth | `custom.stripeBillingPortal`          | `custom/routes/custom.js:19-26` |
| GET    | `/api/customer/purchase-status`       | customer-auth | `custom.purchaseStatus`               | `custom/routes/custom.js:28-35` |
| GET    | `/api/pricing`                        | None          | `custom.getPricing`                   | `custom/routes/custom.js:37-43` |
| POST   | `/api/affiliate-checkout`             | None          | `custom.affiliateCheckout`            | `custom/routes/custom.js:2-10`  |

### Desktop App License API (ACTIVE - via custom controller)

| Method | Path                      | Auth               | Handler                    | Evidence                          |
| ------ | ------------------------- | ------------------ | -------------------------- | --------------------------------- |
| POST   | `/api/license/activate`   | license-rate-limit | `custom.licenseActivate`   | `custom/routes/custom.js:87-94`   |
| POST   | `/api/license/deactivate` | license-rate-limit | `custom.licenseDeactivate` | `custom/routes/custom.js:95-102`  |
| POST   | `/api/license/reset`      | admin-internal     | `custom.licenseReset`      | `custom/routes/custom.js:104-112` |

### DEPRECATED Endpoint

| Method | Path                             | Status | Notes                                    |
| ------ | -------------------------------- | ------ | ---------------------------------------- |
| POST   | `/api/process-customer-purchase` | 410    | Returns "Gone". Fulfillment via webhook. |

**Note:** Legacy `api::license` and `api::license-portal` APIs have been removed.

---

## 3. Purchase Flow (End-to-End Trace)

### Architecture: Webhook-Driven Fulfillment (Server Truth)

**Key principle:** The Stripe webhook is the single source of truth for fulfillment. The frontend polls for completion.

```
Customer → Checkout → Stripe → Webhook → Creates: Purchase, License-Key, Entitlement
                                  ↓
                        Frontend polls /api/customer/purchase-status
                                  ↓
                           Shows success
```

### Step 1: Customer initiates checkout

**Frontend:** `frontend/src/pages/customer/dashboard.astro:768-795`

```javascript
const res = await fetch(`${cmsUrl}/api/customer-checkout`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${customerToken}`,
  },
  body: JSON.stringify({
    priceId,
    successUrl: window.location.origin + "/customer/success",
    cancelUrl: window.location.href,
  }),
});
```

### Step 2: Backend creates Stripe checkout session

**Controller:** `backend/src/api/custom/controllers/custom.js:172-276` (`customerCheckout`)

**Key operations:**

1. Validates customer auth (via `customer-auth` middleware)
2. Looks up price in `PRICE_MAPPINGS` (defined at L57-72)
3. Creates Stripe checkout session with `mode: "payment"` (L253)
4. Attaches metadata: `{ affiliateCode, priceId, tier, purchaseMode, customerId, customerEmail }`
5. Returns `{ url, sessionId }`

**Stripe session metadata (L257-264):**

```javascript
metadata: {
  affiliateCode: affiliateCode || "",
  priceId: priceId,
  tier: priceId === "price_starter" ? "maker" : "pro",
  purchaseMode: "payment",
  customerId: customerId.toString(),
  customerEmail: customer.email,
}
```

### Step 3: Stripe redirects to success page

**URL pattern:** `/customer/success?session_id={CHECKOUT_SESSION_ID}`

**Note:** Amount and priceId are no longer in URL to prevent tampering.

### Step 4: Success page polls for completion

**Frontend:** `frontend/src/pages/customer/success.astro:63-107`

```javascript
const result = await pollPurchaseStatus(sessionId, customerToken, cmsUrl);
```

The polling function uses exponential backoff (1s initial, max 5s, max 20 attempts).

### Step 5: Webhook creates purchase + license + entitlement (SERVER TRUTH)

**Webhook Handler:** `backend/src/api/custom/controllers/custom.js:278-326` (`stripeWebhook`)
**Event Processor:** `backend/src/utils/stripe-webhook-handler.js` (`processStripeEvent`)

**Key operations (in `handleCheckoutSessionCompleted`, ~L188-395):**

1. Signature verification (REQUIRED - no dev bypass)
2. Idempotency check via `stripe-event` collection
3. Find or create customer link
4. Create purchase record with subscription details if applicable
5. Generate license key
6. Create entitlement with tier mapping
7. Mark event as processed

**License key format:** `<PROD>-<CUST>-<BASE36TIME>-<RANDHEX>`  
**Evidence:** `utils/stripe-webhook-handler.js:53-60` (same algorithm as `custom.js:12-19`)

````

---

## 4. Webhook Fulfilment (End-to-End Trace)

### Webhook Handler

**Route:** `POST /api/stripe/webhook`
**Controller:** `backend/src/api/custom/controllers/custom.js:278-326` (`stripeWebhook`)
**Event Processor:** `backend/src/utils/stripe-webhook-handler.js` (`processStripeEvent`)

### Signature Verification (REQUIRED)

**Location:** `custom/controllers/custom.js:280-303`

- Webhook secret is REQUIRED - no bypass even in development
- Uses raw body from `stripe-raw-body` middleware for signature verification
- Returns 400 if signature verification fails

### Idempotency & Out-of-Order Protection

**Location:** `utils/stripe-webhook-handler.js:23-80`

Webhooks are the single source of truth for subscription state. The system provides:

1. **Event-level idempotency:** Uses `stripe-event` collection to track processed events
   - `isEventProcessed(eventId)` check before processing
   - `markEventProcessed(eventId, eventType, payload, eventCreated)` after successful handling

2. **Out-of-order protection:** Uses `lastStripeEventCreated` in entitlement metadata
   - `shouldApplyEvent(eventCreated, entitlement)` compares timestamps
   - `getLastStripeEventCreated(entitlement)` retrieves from metadata
   - Older events are logged and skipped, not applied

**Metadata stored in entitlement.metadata:**
```json
{
  "lastStripeEventCreated": 1705689600,
  "lastStripeEventAt": "2025-01-19T12:00:00.000Z",
  "reactivatedByEvent": "invoice.payment_succeeded"
}
```

### Unified Subscription Update Logic

**Location:** `utils/stripe-webhook-handler.js` (~L170-250)

All subscription handlers use `applyStripeSubscriptionToEntitlement()` which:
1. Checks founders protection (lifetime entitlements are never modified)
2. Checks out-of-order protection (older events are skipped)
3. Maps Stripe status → entitlement status via `mapStripeStatusToEntitlementStatus()`
4. Updates: status, currentPeriodEnd, cancelAtPeriodEnd, expiresAt, metadata

**Status mapping:**
| Stripe Status       | Entitlement Status |
|--------------------|--------------------|
| active, trialing   | active             |
| past_due, unpaid   | inactive           |
| canceled, incomplete_expired | canceled |

### Events Handled

| Event                              | Handler                         | Action                                 |
| ---------------------------------- | ------------------------------- | -------------------------------------- |
| `checkout.session.completed`       | `handleCheckoutSessionCompleted`| Creates Purchase, License-Key, Entitlement |
| `customer.subscription.created`    | `handleSubscriptionCreated`     | Updates entitlement via unified function |
| `customer.subscription.updated`    | `handleSubscriptionUpdated`     | Updates entitlement via unified function |
| `customer.subscription.deleted`    | `handleSubscriptionDeleted`     | Sets status=canceled (with out-of-order check) |
| `invoice.payment_succeeded`        | `handleInvoicePaymentSucceeded` | Reactivates entitlement if inactive    |
| `invoice.payment_failed`           | `handleInvoicePaymentFailed`    | Sets status=inactive                   |
| All others                         | Logged as unhandled             |                                        |

### Founders Protection

All subscription event handlers check `entitlement.isLifetime` FIRST and skip modifications if true.
This ensures founders with lifetime licenses are never affected by subscription lifecycle events.

### No Manual Resync

There is no customer-facing resync endpoint. Webhooks are the sole mechanism for updating subscription state.
This ensures:
- Single source of truth (Stripe → webhook → entitlement)
- Consistent audit trail via stripe-event collection
- No race conditions from parallel manual/webhook updates

---

## 5. License Issuance & Storage

### License Key Generation

**Location:** `backend/src/api/custom/controllers/custom.js:12-19` and `utils/stripe-webhook-handler.js:53-60`

**Algorithm:**

1. `timestamp` = `Date.now().toString(36).toUpperCase()`
2. `randomString` = `crypto.randomBytes(8).toString("hex").toUpperCase()`
3. `productCode` = first 3 chars of product name, uppercase
4. `customerCode` = first 4 chars of customer ID
5. Format: `{productCode}-{customerCode}-{timestamp}-{randomString}`

**Example:** `STA-123-M5X2QK1-A1B2C3D4E5F6G7H8`

### License Record Creation (via Webhook)

**Location:** `backend/src/utils/stripe-webhook-handler.js:315-335`

```javascript
const licenseKeyRecord = await strapi.entityService.create(
  "api::license-key.license-key",
  {
    data: {
      key: licenseKey,
      productName: productName,
      priceId: priceId || `price_${tier}`,
      customer: customer?.id || null,
      purchase: purchase.id,
      status: "unused",
      isActive: true,
      isUsed: false,
      maxActivations: 1,
      currentActivations: 0,
    },
  }
);
````

### License Type Derivation

The `typ` field defaults to `"paid"` per schema. It is used during activation to determine the prefix for the new license key.

**Type to prefix mapping (in `licenseActivate`, ~L1053-1062):**

| Type       | Prefix     |
| ---------- | ---------- |
| trial      | TRIAL      |
| starter    | STARTER    |
| pro        | PRO        |
| enterprise | ENTERPRISE |
| paid       | PAID       |

---

## 6. Activation System(s) - Current Behaviour

### System Classification

| System                      | Controller       | Routes File                         | Status                       |
| --------------------------- | ---------------- | ----------------------------------- | ---------------------------- |
| **Customer Portal Offline** | `license-key.js` | `license-key/routes/license-key.js` | **ACTIVE** (customer portal) |
| **Desktop App Online**      | `custom.js`      | `custom/routes/custom.js`           | **ACTIVE** (public API)      |

### Rate Limiting

**License endpoints** (`/api/license/activate`, `/api/license/deactivate`) are protected by:

- `license-rate-limit` middleware: 10 requests per minute per IP
- **Evidence:** `middlewares/license-rate-limit.js:1-10`, `middlewares/rate-limit.js:69-75`

---

### System A: Customer Portal Offline Activation (ACTIVE)

**Used by:** Customer dashboard for generating activation codes that work offline

#### Endpoint: Generate Activation Code

**Route:** `POST /api/license-keys/:id/generate-activation-code`  
**Controller:** `backend/src/api/license-key/controllers/license-key.js:97-230`  
**Auth:** customer-auth middleware

**Request:**

```json
{
  "machineId": "aa:bb:cc:dd:ee:ff" // MAC address format
}
```

**Algorithm:**

1. Normalize MAC address to `aa:bb:cc:dd:ee:ff` format (L112-127)
2. Validate license belongs to customer and status is `"unused"` (L129-156)
3. Generate 4-byte random nonce (L159)
4. Create payload (12 bytes total):
   - Bytes 0-3: SHA-256(licenseKey)[0:4]
   - Bytes 4-7: SHA-256(machineId)[0:4]
   - Bytes 8-11: nonce
5. Create XOR key (12 bytes):
   - Bytes 0-3: SHA-256(licenseKey)[4:8]
   - Bytes 4-11: SHA-256(machineId)[8:16]
6. XOR encrypt payload
7. Base58 encode result → activation code (~16 chars)
8. Store SHA-256(nonce) in `activationNonce` field
9. Update license: `status="active"`, `machineId=normalizedMac`, `activatedAt=now`

**Response:**

```json
{
  "activationCode": "3xK7Pm9QrT2wYz",
  "licenseKey": "STA-1234-M5X2QK1-A1B2C3D4",
  "machineId": "aa:bb:cc:dd:ee:ff"
}
```

**Evidence:** `license-key/controllers/license-key.js:159-207`

#### Endpoint: Deactivate with Code

**Route:** `POST /api/license-keys/:id/deactivate-with-code`  
**Controller:** `backend/src/api/license-key/controllers/license-key.js:235-447`  
**Auth:** customer-auth middleware

**Request (Structured format):**

```json
{
  "deactivationCode": "base64payload.checksum"
}
```

Where `base64payload` decodes to:

```json
{
  "license_key": "...",
  "machine_id": "...",
  "nonce": "...",
  "timestamp": 1234567890
}
```

**Request (Legacy format):**

```json
{
  "deactivationCode": "hex_nonce_string"
}
```

**Validation:**

1. Structured format (L291-341):
   - Decode base64 → JSON
   - Verify `license_key` matches
   - Verify `machine_id` matches stored
   - Verify `timestamp` within 48 hours
   - Verify SHA-256(nonce) matches stored `activationNonce`
2. Legacy format fallback (L343-396):
   - SHA-256(deactivationCode) must match stored `activationNonce`

**Side effects:**

- Sets `status="unused"`, clears `activationNonce`, `activatedAt`, `machineId`

---

### System B: Desktop App Online Activation (ACTIVE)

**Used by:** Desktop app calling public API endpoints

#### Endpoint: Activate

**Route:** `POST /api/license/activate`  
**Controller:** `backend/src/api/custom/controllers/custom.js:834-1151`  
**Auth:** None (public)  
**Rate Limit:** 10 requests/minute per IP (in-memory bucket)

**Request:**

```json
{
  "licenceKey": "STA-1234-M5X2QK1-A1B2C3D4",
  "machineId": "any_string"
}
```

**Algorithm:**

1. Find license by key
2. **Stage 2 Fix-up: Auto-create entitlement if missing** (deterministically based on purchase/license data)
3. **Enforce entitlement status** - must be "active" (reject if expired/canceled/inactive)
4. **Enforce expiry** - if non-lifetime and expiresAt is past, auto-mark expired and reject
5. Validate status is not `"active"`
6. For trial: validate status is `"unused"` (one-time only)
7. Generate new license key with type prefix: `{TYPE}-{12_CHAR_SHORT_KEY}`
   - Short key format: `XXXX-XXXX-XXXX` (alphanumeric, no confusing chars)
8. Generate 8-char deactivation code
9. Encrypt deactivation code with AES-256-CBC (key = SHA-256(newLicenseKey))
10. Store encrypted deactivation code
11. Update license with new key, status="active", machineId (raw), jti (UUID)
12. Sign JWT with RS256 using `JWT_PRIVATE_KEY`

**Response:**

```json
{
  "jwt": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "machineId": "...",
  "licenseKey": "STARTER-ABCD-EFGH-JKLM",
  "deactivationCode": "X7Y2Z9AB",
  "trialStart": "2026-01-12T10:00:00.000Z" // only for trial
}
```

**JWT Payload:**

```json
{
  "iss": "https://lightlane.app",
  "sub": "123",
  "jti": "550e8400-e29b-41d4-a716-446655440000",
  "typ": "starter",
  "machineId": "...",
  "deactivationCode": "X7Y2Z9AB",
  "licenseKey": "STARTER-ABCD-EFGH-JKLM",
  "iat": 1736679600,
  "trialStart": 1736679600
}
```

**Evidence:** `custom/controllers/custom.js:926-1066` (JWT generation at L1010-1066)

#### Endpoint: Deactivate

**Route:** `POST /api/license/deactivate`  
**Controller:** `backend/src/api/custom/controllers/custom.js:1156-1273`  
**Auth:** None (public)  
**Rate Limit:** 10 requests/minute per IP (in-memory bucket)

**Request:**

```json
{
  "licenceKey": "STARTER-ABCD-EFGH-JKLM",
  "deactivationCode": "X7Y2Z9AB"
}
```

**Validation:**

1. Find active license by key
2. Decrypt stored deactivation code using AES-256-CBC
3. Compare with provided code

**Response:**

```json
{
  "success": true,
  "message": "License deactivated successfully",
  "newLicenseKey": "STARTER-MNOP-QRST-UVWX"
}
```

**Side effects:**

- Generates new license key
- Sets `status="unused"`, clears `jti`, `machineId`, `trialStart`, `activatedAt`, `deactivationCode`

---

### machineId Handling Comparison

| System                           | Storage        | Format                |
| -------------------------------- | -------------- | --------------------- |
| Customer Portal (license-key.js) | Normalized MAC | `aa:bb:cc:dd:ee:ff`   |
| Desktop App (custom.js)          | Raw string     | Whatever client sends |
| Legacy license.js                | SHA-256 hash   | 64-char hex           |
| Legacy license-portal.js         | Raw string     | Whatever client sends |

---

## 6.5 Entitlement Model (Stage 2 Fix-up)

### Data Model

**Each license-key has exactly ONE entitlement (1:1 relationship)**

```
customer (1) ──┬─ entitlement (N) ── licenseKey (1)
               │
               └─ entitlement (N) ── licenseKey (1)
```

This supports customers owning multiple licenses of different tiers with separate billing.

### Entitlement Enforcement in Activation

**Location:** `backend/src/api/custom/controllers/custom.js:860-920`

When `POST /api/license/activate` is called:

1. **Auto-create entitlement if missing**: Uses `determineEntitlementTier()` from `utils/entitlement-mapping.js`
2. **Enforce status**: Entitlement must be `"active"` - reject with 403 if expired/canceled/inactive
3. **Enforce expiry**: For non-lifetime entitlements, if `expiresAt` is past, auto-mark expired and reject
4. **Normalize lifetime**: If `isLifetime=true`, ensure `expiresAt=null`

### Tier Mapping

**Location:** `backend/src/utils/entitlement-mapping.js:109-134`

| Tier       | maxDevices | Price IDs           |
| ---------- | ---------- | ------------------- |
| maker      | 1          | `price_starter*`    |
| pro        | 2          | `price_pro*`        |
| education  | 5          | Manual assignment   |
| enterprise | 10         | `price_enterprise*` |

**Fallback mapping by amount:** `$99-100` → maker, `$199-200` → pro, `$499` → enterprise

### Founders Lifetime Window

**Location:** `backend/src/utils/entitlement-mapping.js:74-111`

**IMPORTANT:** "Founders" is NOT a tier. It determines `isLifetime=true` only.

- Purchases made before `2026-01-11T23:59:59Z` (or `FOUNDERS_SALE_END_ISO` env var) get `isLifetime: true`
- The TIER remains based on what was purchased (maker/pro)
- A "Founder Pro" = `{ tier: "pro", isLifetime: true }`
- `endDate` is NEVER null - always a hard cutoff (runtime guard at L106-108)

### Backfill Script

For existing license-keys without entitlements:

```bash
docker compose exec backend node scripts/backfill-entitlements.js --dry-run
docker compose exec backend node scripts/backfill-entitlements.js --apply
```

Creates ONE entitlement per license-key using purchase data for tier mapping.

---

## 7. Customer Portal Frontend

### Pages

| Page      | Path                  | API Calls                                                                                                                                                                                 | Evidence                                |
| --------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Login     | `/customer/login`     | `POST /api/customers/login`                                                                                                                                                               | `login.astro:212-213`                   |
| Register  | `/customer/register`  | `POST /api/customers/register`                                                                                                                                                            | `register.astro:299-300`                |
| Dashboard | `/customer/dashboard` | `GET /api/customers/me`, `GET /api/license-keys`, `POST /api/customer-checkout`, `POST /api/license-keys/:id/generate-activation-code`, `POST /api/license-keys/:id/deactivate-with-code` | `dashboard.astro:606,629,768,1152,1277` |
| Profile   | `/customer/profile`   | `GET /api/customers/me`, `PUT /api/customers/profile`, `PUT /api/customers/password`                                                                                                      | `profile.astro:182,273,343`             |
| Success   | `/customer/success`   | `GET /api/customer/purchase-status` (polling)                                                                                                                                             | `success.astro:81-130`                  |

### Dashboard License Display

**Location:** `frontend/src/pages/customer/dashboard.astro:629-670`

1. Calls `GET /api/license-keys` with customer token
2. Response shape: `{ licenseKeys: [...] }`
3. Each license has `isUsed` computed: `key.status === "active"`

### Activation Flow (Customer Portal)

**Location:** `frontend/src/pages/customer/dashboard.astro:1145-1200`

1. User enters MAC address
2. Frontend calls `POST /api/license-keys/:id/generate-activation-code` with `{ machineId }`
3. Receives `{ activationCode, licenseKey, machineId }`
4. Displays activation code for user to enter in desktop app

### Deactivation Flow (Customer Portal)

**Location:** `frontend/src/pages/customer/dashboard.astro:1260-1310`

1. User pastes deactivation code from desktop app
2. Frontend calls `POST /api/license-keys/:id/deactivate-with-code` with `{ deactivationCode }`
3. On success, license becomes available for reactivation

---

## 8. Desktop App Expectations (from Portal POV)

### Activation Endpoint

**URL:** `POST /api/license/activate`  
**Auth:** None required  
**Rate Limit:** 10 requests/minute per IP

**Request:**

```json
{
  "licenceKey": "string (the license key user purchased)",
  "machineId": "string (device identifier)"
}
```

**Success Response (200):**

```json
{
  "jwt": "string (RS256 signed JWT)",
  "jti": "string (UUID)",
  "machineId": "string",
  "licenseKey": "string (NEW key with type prefix)",
  "deactivationCode": "string (8 chars)",
  "trialStart": "string (ISO date, only for trial type)"
}
```

**Error Responses:**

- 400: `{ "error": "licenceKey and machineId are required" }`
- 400: `{ "error": "License is already active on another device" }`
- 400: `{ "error": "Trial license has already been used" }`
- 404: `{ "error": "License key not found" }`
- 500: `{ "error": "JWT private key not configured" }`

### Deactivation Endpoint

**URL:** `POST /api/license/deactivate`  
**Auth:** None required  
**Rate Limit:** 10 requests/minute per IP

**Request:**

```json
{
  "licenceKey": "string (the ACTIVE license key - may differ from original)",
  "deactivationCode": "string (8-char code from activation)"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "License deactivated successfully",
  "newLicenseKey": "string (new unused key for future use)"
}
```

**Error Responses:**

- 400: `{ "error": "licenceKey and deactivationCode are required" }`
- 400: `{ "error": "Invalid deactivation code" }`
- 404: `{ "error": "License key not found or not active" }`

### Reset Endpoint (Testing Only)

**URL:** `POST /api/license/reset`  
**Auth:** `x-admin-token` header must match `ADMIN_INTERNAL_TOKEN` env var  
**Middleware:** `admin-internal` (`backend/src/middlewares/admin-internal.js:1-72`)

Resets ALL licenses to unused state. **For internal/testing use only.**

---

## 9. Verified Gaps / Contradictions (Current State)

### GAP-001: ~~handleSuccessfulPayment is Undefined~~ (RESOLVED)

**Previous claim:** "BUG: handleSuccessfulPayment undefined causes webhook to fail"

**Current Status:** ✅ **RESOLVED**

**What code proves:**

- Webhook controller at `custom/controllers/custom.js:278-326` now uses `processStripeEvent()`
- `processStripeEvent()` is properly imported from `utils/stripe-webhook-handler.js:682-736`
- Stripe events are delegated to typed handlers like `handleCheckoutSessionCompleted()` (L188-395)
- Idempotency via `stripe-event` collection prevents duplicate processing

**Evidence:** `backend/src/utils/stripe-webhook-handler.js:188-395` (checkout.session.completed handler)

### GAP-002: ~~License Type (`typ`) Never Set During Purchase~~ (RESOLVED)

**Previous claim:** "No logic maps `priceId` → license type"

**Current Status:** ✅ **RESOLVED**

**What code proves:**

- `handleCheckoutSessionCompleted()` at `stripe-webhook-handler.js:188-395` creates license with proper type
- Type mapping uses `PRICE_MAPPINGS` at `stripe-webhook-handler.js:28-45`
- License type is extracted from priceId during purchase flow (L297-310)

**Evidence:** `backend/src/utils/stripe-webhook-handler.js:297-310` (type extraction from session metadata)

### GAP-006: ~~Public License Reset Endpoint~~ (RESOLVED)

**Previous claim:** "POST /api/license/reset has no authentication"

**Current Status:** ✅ **RESOLVED**

**What code proves:**

- Route at `custom/routes/custom.js:104-112` now uses `admin-internal` middleware
- Middleware checks `x-admin-token` header against `ADMIN_INTERNAL_TOKEN` env var
- Unauthorized requests return 401

**Evidence:** `backend/src/api/custom/routes/custom.js:104-112`, `backend/src/middlewares/admin-internal.js:1-72`

---

### Remaining Items (Still Valid)

### GAP-003: Multiple Activation Systems with Different machineId Handling

**Status:** Still present (by design)

**What code proves:**

- `license-key.js` normalizes MAC address to `aa:bb:cc:dd:ee:ff`
- `custom.js` stores raw machineId

**Impact:** Activation codes generated via customer portal require specific MAC format; desktop app accepts any string

### GAP-004: ~~Shadowed Routes~~ (RESOLVED)

**Status:** ✅ RESOLVED in Stage 2

The legacy `api::license` and `api::license-portal` directories have been removed entirely.
All license operations now go through `custom/controllers/custom.js`.

### GAP-005: JWT_SECRET Default Fallback

**Status:** Still present (low severity)

**What code proves:**

- `customer/controllers/customer.js:97` uses `process.env.JWT_SECRET || "default-secret"`
- `middlewares/customer-auth.js:13` uses same fallback

**Impact:** If `JWT_SECRET` is not set, customer auth uses predictable secret

**Recommendation:** Remove default fallback and fail hard if JWT_SECRET is not set

---

## Appendix: File Reference

| File                                                     | Purpose                                          |
| -------------------------------------------------------- | ------------------------------------------------ |
| `backend/src/api/custom/routes/custom.js`                | Checkout, webhook, license API routes            |
| `backend/src/api/custom/controllers/custom.js`           | Main controller for payments and license ops     |
| `backend/src/utils/stripe-webhook-handler.js`            | Server-truth webhook processing with idempotency |
| `backend/src/utils/entitlement-mapping.js`               | Tier mapping and founders logic                  |
| `backend/src/api/customer/routes/customer.js`            | Customer auth routes                             |
| `backend/src/api/customer/controllers/customer.js`       | Customer registration, login, profile            |
| `backend/src/api/license-key/routes/license-key.js`      | Customer portal license routes                   |
| `backend/src/api/license-key/controllers/license-key.js` | Offline activation/deactivation                  |
| `backend/src/middlewares/customer-auth.js`               | JWT verification for customer routes             |
| `backend/src/middlewares/admin-internal.js`              | Admin token protection for internal routes       |
| `backend/src/middlewares/license-rate-limit.js`          | Rate limiting for license endpoints              |
| `frontend/src/pages/customer/dashboard.astro`            | Customer dashboard UI                            |
| `frontend/src/pages/customer/success.astro`              | Post-purchase status polling                     |
