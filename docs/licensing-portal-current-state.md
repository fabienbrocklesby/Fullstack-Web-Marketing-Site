# LightLane Licensing Portal - Current State (Verified)

**Audit Date:** 2026-01-12  
**Last Updated:** Stage 2 Fix-up (Entitlements per License-Key 1:1)
**Scope:** Website/Portal licensing system only (not desktop app internals)

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

| Variable                | Usage                          | File:Line                                                                    |
| ----------------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | Stripe API authentication      | `custom/controllers/custom.js:1`                                             |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | `custom/controllers/custom.js:256`                                           |
| `JWT_SECRET`            | Customer token signing (HS256) | `customer/controllers/customer.js:97,170`, `middlewares/customer-auth.js:13` |
| `JWT_PRIVATE_KEY`       | License token signing (RS256)  | `custom/controllers/custom.js:849`                                           |
| `JWT_ISSUER`            | JWT issuer claim               | `custom/controllers/custom.js:833`                                           |
| `NODE_ENV`              | Dev mode checks                | Multiple files                                                               |
| `FOUNDERS_SALE_END_ISO` | Founders sale end override     | `utils/entitlement-mapping.js` (default: 2026-01-11T23:59:59Z)               |

---

## 1. Data Model (Schemas)

### license-key

**File:** `backend/src/api/license-key/content-types/license-key/schema.json`

| Field                | Type     | Required | Default    | Notes                                               |
| -------------------- | -------- | -------- | ---------- | --------------------------------------------------- |
| `key`                | string   | ✓        | -          | Unique                                              |
| `productName`        | string   | ✓        | -          |                                                     |
| `priceId`            | string   | ✓        | -          |                                                     |
| `customer`           | relation | -        | -          | manyToOne → customer                                |
| `customerEmail`      | email    | -        | -          |                                                     |
| `purchase`           | relation | -        | -          | oneToOne → purchase                                 |
| `entitlement`        | relation | -        | -          | oneToOne → entitlement (Stage 2 Fix-up: 1:1)        |
| `isActive`           | boolean  | -        | `true`     |                                                     |
| `status`             | enum     | -        | `"unused"` | `["unused", "active"]`                              |
| `jti`                | string   | -        | -          | JWT ID for current activation                       |
| `machineId`          | string   | -        | -          | Device fingerprint (normalized MAC or hash)         |
| `typ`                | enum     | -        | `"paid"`   | `["trial", "paid", "starter", "pro", "enterprise"]` |
| `trialStart`         | datetime | -        | -          |                                                     |
| `isUsed`             | boolean  | -        | `false`    | Legacy field                                        |
| `deviceInfo`         | json     | -        | -          |                                                     |
| `activatedAt`        | datetime | -        | -          |                                                     |
| `expiresAt`          | datetime | -        | -          |                                                     |
| `maxActivations`     | integer  | -        | `1`        |                                                     |
| `currentActivations` | integer  | -        | `0`        |                                                     |
| `deactivationCode`   | text     | -        | -          | Encrypted deactivation code                         |
| `activationNonce`    | string   | -        | -          | SHA-256 hashed nonce for offline deactivation       |

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
| `resetPasswordToken`    | string   | -        | -       | Private                 |
| `resetPasswordExpires`  | datetime | -        | -       | Private                 |
| `metadata`              | json     | -        | -       |                         |
| `originEnquiryId`       | string   | -        | -       |                         |
| `affiliateCodeAtSignup` | string   | -        | -       |                         |

### purchase

**File:** `backend/src/api/purchase/content-types/purchase/schema.json`

| Field              | Type     | Required | Default | Notes                             |
| ------------------ | -------- | -------- | ------- | --------------------------------- |
| `stripeSessionId`  | string   | ✓        | -       | Unique                            |
| `isManual`         | boolean  | -        | `false` |                                   |
| `manualReason`     | text     | -        | -       |                                   |
| `createdByAdmin`   | relation | -        | -       | oneToOne → users-permissions.user |
| `amount`           | decimal  | ✓        | -       |                                   |
| `currency`         | string   | -        | `"usd"` |                                   |
| `customerEmail`    | email    | -        | -       |                                   |
| `priceId`          | string   | ✓        | -       |                                   |
| `affiliate`        | relation | -        | -       | manyToOne → affiliate             |
| `customer`         | relation | -        | -       | manyToOne → customer              |
| `licenseKey`       | relation | -        | -       | oneToOne → license-key            |
| `commissionAmount` | decimal  | -        | `0`     |                                   |
| `commissionPaid`   | boolean  | -        | `false` |                                   |
| `metadata`         | json     | -        | -       |                                   |

### entitlement (Stage 2 Fix-up - 1:1 with License-Key)

**File:** `backend/src/api/entitlement/content-types/entitlement/schema.json`

| Field        | Type     | Required | Default             | Notes                                           |
| ------------ | -------- | -------- | ------------------- | ----------------------------------------------- |
| `customer`   | relation | -        | -                   | manyToOne → customer                            |
| `licenseKey` | relation | -        | -                   | oneToOne → license-key (Stage 2 Fix-up)         |
| `purchase`   | relation | -        | -                   | oneToOne → purchase (optional)                  |
| `tier`       | enum     | ✓        | -                   | `["maker", "pro", "education", "enterprise"]`   |
| `status`     | enum     | ✓        | `"active"`          | `["active", "inactive", "expired", "canceled"]` |
| `isLifetime` | boolean  | ✓        | `false`             | True for founders purchases                     |
| `expiresAt`  | datetime | -        | -                   | Null for lifetime entitlements                  |
| `maxDevices` | integer  | -        | `1`                 | Tier-based: maker=1, pro=2, edu=5, ent=10       |
| `source`     | enum     | -        | `"legacy_purchase"` | `["legacy_purchase", "manual", "subscription"]` |
| `metadata`   | json     | -        | -                   |                                                 |
| `devices`    | relation | -        | -                   | oneToMany → device                              |

**Stage 2 Fix-up: Per-License Entitlements (1:1)**

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

| Method | Path                                             | Auth          | Handler                              | Evidence                                  |
| ------ | ------------------------------------------------ | ------------- | ------------------------------------ | ----------------------------------------- |
| POST   | `/api/customers/register`                        | None          | `customer.register`                  | `customer/routes/customer.js:2-9`         |
| POST   | `/api/customers/login`                           | None          | `customer.login`                     | `customer/routes/customer.js:10-17`       |
| GET    | `/api/customers/me`                              | customer-auth | `customer.me`                        | `customer/routes/customer.js:18-26`       |
| PUT    | `/api/customers/profile`                         | customer-auth | `customer.updateProfile`             | `customer/routes/customer.js:27-35`       |
| PUT    | `/api/customers/password`                        | customer-auth | `customer.changePassword`            | `customer/routes/customer.js:36-44`       |
| GET    | `/api/customers/entitlements`                    | customer-auth | `customer.entitlements`              | `customer/routes/customer.js:45-53`       |
| GET    | `/api/license-keys`                              | customer-auth | `license-key.find`                   | `license-key/routes/license-key.js:2-11`  |
| GET    | `/api/license-keys/:id`                          | customer-auth | `license-key.findOne`                | `license-key/routes/license-key.js:12-21` |
| POST   | `/api/license-keys/:id/generate-activation-code` | customer-auth | `license-key.generateActivationCode` | `license-key/routes/license-key.js:22-31` |
| POST   | `/api/license-keys/:id/deactivate-with-code`     | customer-auth | `license-key.deactivateWithCode`     | `license-key/routes/license-key.js:32-42` |

### Checkout & Payment Routes (ACTIVE)

| Method | Path                             | Auth          | Handler                          | Evidence                        |
| ------ | -------------------------------- | ------------- | -------------------------------- | ------------------------------- |
| POST   | `/api/customer-checkout`         | customer-auth | `custom.customerCheckout`        | `custom/routes/custom.js:26-34` |
| POST   | `/api/process-customer-purchase` | customer-auth | `custom.processCustomerPurchase` | `custom/routes/custom.js:35-43` |
| POST   | `/api/stripe/webhook`            | None          | `custom.stripeWebhook`           | `custom/routes/custom.js:11-18` |
| POST   | `/api/affiliate-checkout`        | None          | `custom.affiliateCheckout`       | `custom/routes/custom.js:2-10`  |

### Desktop App License API (ACTIVE - via custom controller)

| Method | Path                      | Auth | Handler                    | Evidence                        |
| ------ | ------------------------- | ---- | -------------------------- | ------------------------------- |
| POST   | `/api/license/activate`   | None | `custom.licenseActivate`   | `custom/routes/custom.js:47-54` |
| POST   | `/api/license/deactivate` | None | `custom.licenseDeactivate` | `custom/routes/custom.js:55-62` |
| POST   | `/api/license/reset`      | None | `custom.licenseReset`      | `custom/routes/custom.js:63-70` |

### Shadowed Routes (REMOVED in Stage 2)

The legacy `api::license` and `api::license-portal` APIs have been removed.
All license activation/deactivation is now handled exclusively by `custom.licenseActivate` and `custom.licenseDeactivate`.

---

## 3. Purchase Flow (End-to-End Trace)

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

**Controller:** `backend/src/api/custom/controllers/custom.js:142-247` (`customerCheckout`)

**Key operations:**

1. Validates customer auth (via `customer-auth` middleware)
2. Looks up price in `PRICE_MAPPINGS` (hardcoded at L20-43)
3. Creates Stripe checkout session with `mode: "payment"` (L224)
4. Attaches metadata: `{ customerId, customerEmail, affiliateCode, originalPriceId, priceAmount }`
5. Returns `{ url, sessionId }`

**Stripe session metadata (L226-233):**

```javascript
metadata: {
  affiliateCode: affiliateCode || "",
  originalPriceId: priceId,
  priceAmount: priceInfo.amount.toString(),
  customerId: customerId.toString(),
  customerEmail: customer.email,
}
```

### Step 3: Stripe redirects to success page

**URL pattern:** `/customer/success?session_id={CHECKOUT_SESSION_ID}&price_id={priceId}&amount={amount}`

### Step 4: Success page calls processCustomerPurchase

**Frontend:** `frontend/src/pages/customer/success.astro:77-98`

```javascript
const response = await fetch(`${cmsUrl}/api/process-customer-purchase`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${customerToken}`,
  },
  body: JSON.stringify({
    sessionId: sessionId,
    priceId: priceId,
    amount: parseInt(amount),
    affiliateCode: affiliateCode,
  }),
});
```

### Step 5: Backend creates purchase + license

**Controller:** `backend/src/api/custom/controllers/custom.js:499-696` (`processCustomerPurchase`)

**Key operations:**

1. Validates customer auth
2. Checks for existing purchase with same `stripeSessionId` (L553-575) - returns early if duplicate
3. Creates purchase record (L578-598)
4. Generates license key using inline `generateLicenseKey()` function (L9-17)
5. Creates license-key record linked to customer and purchase (L601-621)
6. Updates purchase with license-key reference (L629-647)
7. Updates affiliate earnings if applicable (L650-663)

**License key format:** `<PROD>-<CUST>-<BASE36TIME>-<RANDHEX>`  
**Evidence:** `custom/controllers/custom.js:9-17`

```javascript
function generateLicenseKey(productName, customerId, attempt = 0) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const randomString = crypto.randomBytes(8).toString("hex").toUpperCase();
  const productCode = (productName || "PRD").substring(0, 3).toUpperCase();
  const customerCode = (customerId?.toString() || "0000").substring(0, 4);
  return `${productCode}-${customerCode}-${timestamp}-${randomString}`;
}
```

---

## 4. Webhook Fulfilment (End-to-End Trace)

### Webhook Handler

**Route:** `POST /api/stripe/webhook`  
**Controller:** `backend/src/api/custom/controllers/custom.js:252-296` (`stripeWebhook`)

### Events Handled

| Event                        | Handler                                  | Evidence |
| ---------------------------- | ---------------------------------------- | -------- |
| `checkout.session.completed` | Calls `handleSuccessfulPayment(session)` | L285-291 |
| All others                   | Logged as unhandled                      | L292-293 |

### CRITICAL ISSUE: `handleSuccessfulPayment` is UNDEFINED

**Evidence:**

```bash
$ grep -n "handleSuccessfulPayment" backend/src/api/custom/controllers/custom.js
290:        await handleSuccessfulPayment(session);

$ grep -n "function handleSuccessfulPayment\|const handleSuccessfulPayment\|handleSuccessfulPayment =" backend/src/**/*.js
(no results)
```

**Analysis:**

- The function is called at L290 but never defined anywhere in the codebase
- If the webhook fires, it will throw `ReferenceError: handleSuccessfulPayment is not defined`

### WHY PRODUCTION WORKS (without the webhook)

The **actual production flow bypasses the webhook entirely**:

1. Customer completes Stripe checkout
2. Stripe redirects to `/customer/success?session_id=...&price_id=...&amount=...`
3. Frontend JavaScript on `success.astro` extracts URL params and calls `/api/process-customer-purchase`
4. `processCustomerPurchase` controller creates the purchase and license

**The webhook is DEAD CODE** - it would fail if Stripe ever sent an event, but the frontend-driven flow handles fulfilment.

**Evidence for frontend-driven flow:**

- `frontend/src/pages/customer/success.astro:77-98` - calls `process-customer-purchase`
- No usage of webhook in customer portal flow

### Webhook Signature Verification

**Location:** `custom/controllers/custom.js:260-275`

- In production: Verifies signature using `STRIPE_WEBHOOK_SECRET`
- In development: Skips verification if `NODE_ENV === "development"` and secret is missing/placeholder

---

## 5. License Issuance & Storage

### License Key Generation

**Location:** `backend/src/api/custom/controllers/custom.js:9-17`

**Algorithm:**

1. `timestamp` = `Date.now().toString(36).toUpperCase()`
2. `randomString` = `crypto.randomBytes(8).toString("hex").toUpperCase()`
3. `productCode` = first 3 chars of product name, uppercase
4. `customerCode` = first 4 chars of customer ID
5. Format: `{productCode}-{customerCode}-{timestamp}-{randomString}`

**Example:** `STA-123-M5X2QK1-A1B2C3D4E5F6G7H8`

### License Record Creation

**Location:** `backend/src/api/custom/controllers/custom.js:601-621`

```javascript
const licenseKeyRecord = await strapi.entityService.create(
  "api::license-key.license-key",
  {
    data: {
      key: licenseKey,
      productName: priceInfo.name,
      priceId: priceId,
      customer: customer.id,
      purchase: purchase.id,
      status: "unused",
      isActive: true,
      isUsed: false,
      maxActivations: 1,
      currentActivations: 0,
    },
  }
);
```

### License Type Derivation

The `typ` field is **NOT set during purchase**. It defaults to `"paid"` per schema.

The `typ` field only matters during activation:

- `custom.licenseActivate` uses `licenseRecord.typ` to determine prefix (L780-789)
- If `typ === "trial"`, special restrictions apply (one-time activation only)

---

## 6. Activation System(s) - Current Behaviour

### System Classification

| System                      | Controller       | Routes File                         | Status                       |
| --------------------------- | ---------------- | ----------------------------------- | ---------------------------- |
| **Customer Portal Offline** | `license-key.js` | `license-key/routes/license-key.js` | **ACTIVE** (customer portal) |
| **Desktop App Online**      | `custom.js`      | `custom/routes/custom.js`           | **ACTIVE** (public API)      |

**Note:** Legacy `license-portal.js` and `license.js` controllers have been removed (Stage 2 cleanup).

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
**Controller:** `backend/src/api/custom/controllers/custom.js:708-873`  
**Auth:** None (public)

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

**Evidence:** `custom/controllers/custom.js:758-868`

#### Endpoint: Deactivate

**Route:** `POST /api/license/deactivate`  
**Controller:** `backend/src/api/custom/controllers/custom.js:875-1007`  
**Auth:** None (public)

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

When `POST /api/license/activate` is called:

1. **Auto-create entitlement if missing**: Uses `determineEntitlementTier()` to map purchase data to tier/features
2. **Enforce status**: Entitlement must be `"active"` - reject with 403 if expired/canceled/inactive
3. **Enforce expiry**: For non-lifetime entitlements, if `expiresAt` is past, auto-mark expired and reject
4. **Normalize lifetime**: If `isLifetime=true`, ensure `expiresAt=null`

### Tier Mapping

| Tier       | maxDevices | Price Range (Founders)  |
| ---------- | ---------- | ----------------------- |
| maker      | 1          | < $150                  |
| pro        | 2          | $150 - $300             |
| education  | 5          | Manual assignment       |
| enterprise | 10         | > $300 or enterprise ID |

### Founders Lifetime Window

Purchases made before `2026-01-11T23:59:59Z` (or `FOUNDERS_SALE_END_ISO`) get `isLifetime: true`.

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
| Dashboard | `/customer/dashboard` | `GET /api/customers/me`, `GET /api/license-keys`, `POST /api/customer-checkout`, `POST /api/license-keys/:id/generate-activation-code`, `POST /api/license-keys/:id/deactivate-with-code` | `dashboard.astro:606,629,768,1152,1276` |
| Profile   | `/customer/profile`   | `GET /api/customers/me`, `PUT /api/customers/profile`, `PUT /api/customers/password`                                                                                                      | `profile.astro:182,273,343`             |
| Success   | `/customer/success`   | `POST /api/process-customer-purchase`                                                                                                                                                     | `success.astro:81-82`                   |

### Dashboard License Display

**Location:** `frontend/src/pages/customer/dashboard.astro:629-668`

1. Calls `GET /api/license-keys` with customer token
2. Response shape: `{ licenseKeys: [...] }`
3. Each license has `isUsed` computed: `key.status === "active"`

### Activation Flow (Customer Portal)

**Location:** `frontend/src/pages/customer/dashboard.astro:1146-1192`

1. User enters MAC address
2. Frontend calls `POST /api/license-keys/:id/generate-activation-code` with `{ machineId }`
3. Receives `{ activationCode, licenseKey, machineId }`
4. Displays activation code for user to enter in desktop app

### Deactivation Flow (Customer Portal)

**Location:** `frontend/src/pages/customer/dashboard.astro:1256-1299`

1. User pastes deactivation code from desktop app
2. Frontend calls `POST /api/license-keys/:id/deactivate-with-code` with `{ deactivationCode }`
3. On success, license becomes available for reactivation

---

## 8. Desktop App Expectations (from Portal POV)

### Activation Endpoint

**URL:** `POST /api/license/activate`  
**Auth:** None required

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
**Auth:** None (should be restricted)

Resets ALL licenses to unused state. **Not intended for production use.**

---

## 9. Verified Gaps / Contradictions (Current State)

### GAP-001: handleSuccessfulPayment is Undefined

**Previous claim:** "BUG: handleSuccessfulPayment undefined causes webhook to fail"

**What code proves:**

- Function is called at `custom/controllers/custom.js:290`
- Function is never defined anywhere in codebase
- If `checkout.session.completed` event is received, webhook WILL throw `ReferenceError`

**Why production works:**

- Production flow uses frontend-driven fulfilment via `/api/process-customer-purchase`
- Webhook is effectively dead code
- No evidence Stripe webhook is even configured in production

**Cannot prove:** Whether Stripe webhook is configured in production environment

### GAP-002: License Type (`typ`) Never Set During Purchase

**What code proves:**

- `processCustomerPurchase` creates license with defaults (L601-621)
- Schema default is `"paid"` (`license-key/content-types/license-key/schema.json:67`)
- No logic maps `priceId` → license type

**Impact:** All purchased licenses have `typ="paid"` regardless of price tier

**Cannot prove:** Whether this is intentional or a bug

### GAP-003: Multiple Activation Systems with Different machineId Handling

**What code proves:**

- `license-key.js` normalizes MAC address to `aa:bb:cc:dd:ee:ff`
- `custom.js` stores raw machineId

**Impact:** Activation codes generated via customer portal require specific MAC format; desktop app accepts any string

### GAP-004: Shadowed Routes (RESOLVED)

**Status:** RESOLVED in Stage 2

The legacy `api::license` and `api::license-portal` directories have been removed entirely.
All license operations now go through `custom/controllers/custom.js`.

### GAP-005: JWT_SECRET Default Fallback

**What code proves:**

- `customer/controllers/customer.js:97` uses `process.env.JWT_SECRET || "default-secret"`
- `middlewares/customer-auth.js:13` uses same fallback

**Impact:** If `JWT_SECRET` is not set, customer auth uses predictable secret

### GAP-006: Public License Reset Endpoint

**What code proves:**

- `POST /api/license/reset` has no authentication (`custom/routes/custom.js:63-70`)
- Resets ALL licenses to unused state

**Impact:** Anyone can reset all licenses if they know the endpoint exists

---

## Appendix: File Reference

| File                                                     | Purpose                                      |
| -------------------------------------------------------- | -------------------------------------------- |
| `backend/src/api/custom/routes/custom.js`                | Checkout, webhook, license API routes        |
| `backend/src/api/custom/controllers/custom.js`           | Main controller for payments and license ops |
| `backend/src/api/customer/routes/customer.js`            | Customer auth routes                         |
| `backend/src/api/customer/controllers/customer.js`       | Customer registration, login, profile        |
| `backend/src/api/license-key/routes/license-key.js`      | Customer portal license routes               |
| `backend/src/api/license-key/controllers/license-key.js` | Offline activation/deactivation              |
| `backend/src/middlewares/customer-auth.js`               | JWT verification for customer routes         |
| `frontend/src/pages/customer/dashboard.astro`            | Customer dashboard UI                        |
| `frontend/src/pages/customer/success.astro`              | Post-purchase processing                     |
