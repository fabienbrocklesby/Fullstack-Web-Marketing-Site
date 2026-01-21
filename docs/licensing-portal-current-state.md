# LightLane Licensing Portal - Current State (Verified)

**Audit Date:** 2026-01-21  
**Last Updated:** Stage 5.5 Cutover - Legacy MAC-based activation retired  
**Scope:** Website/Portal licensing system only (not desktop app internals)

---

## Status at a Glance

### Active System (Stage 4/5)

| What                 | Endpoint/Field                        | Notes                            |
| -------------------- | ------------------------------------- | -------------------------------- |
| Register device      | `POST /api/device/register`           | deviceId + publicKey             |
| Activate entitlement | `POST /api/licence/activate`          | Binds device to entitlement      |
| Refresh lease        | `POST /api/licence/refresh`           | Subscriptions only (7-day token) |
| Deactivate           | `POST /api/licence/deactivate`        | Unbinds device                   |
| Offline challenge    | `POST /api/licence/offline-challenge` | Subscriptions only               |
| Offline refresh      | `POST /api/licence/offline-refresh`   | Subscriptions only               |
| List entitlements    | `GET /api/customers/me/entitlements`  | Includes `leaseRequired` field   |
| List devices         | `GET /api/customers/me/devices`       | Customer's registered devices    |

### Retired (Legacy MAC-based) — Returns 410 Gone

| What                   | Endpoint                                              | Migration                     |
| ---------------------- | ----------------------------------------------------- | ----------------------------- |
| Legacy list keys       | `GET /api/license-keys`                               | Use entitlements endpoint     |
| Legacy generate code   | `POST /api/license-keys/:id/generate-activation-code` | Use `/api/licence/activate`   |
| Legacy deactivate code | `POST /api/license-keys/:id/deactivate-with-code`     | Use `/api/licence/deactivate` |
| Legacy app activate    | `POST /api/license/activate`                          | Use `/api/licence/activate`   |
| Legacy app deactivate  | `POST /api/license/deactivate`                        | Use `/api/licence/deactivate` |

### App Integration Quick Reference

**Online subscription flow:**

```
login → GET /customers/me/entitlements → POST /device/register → POST /licence/activate → periodic POST /licence/refresh
```

**Online lifetime flow:**

```
login → GET /customers/me/entitlements → POST /device/register → POST /licence/activate (no refresh needed)
```

**Offline subscription flow (air-gapped machines):**

```
portal: POST /licence/offline-challenge → copy token to air-gapped machine → bring response back → POST /licence/offline-refresh → copy lease token back → repeat every 7 days
```

**Offline lifetime:** Not supported (online-only, no lease tokens needed).

---

## Changelog (2026-01-22 Stage 5.5 Cutover)

### 🚨 BREAKING CHANGES - Legacy MAC Activation Retired

Stage 5.5 completes the migration to a unified device-based activation system. **All activation now uses the Stage 4/5 device-based entitlement system.** Legacy MAC-based activation endpoints have been retired and return 410 Gone.

### ❌ Retired Endpoints (Return 410 Gone)

All legacy MAC-address based activation endpoints now return HTTP 410 Gone with migration guidance:

| Endpoint                                              | Status   | Migration                                      |
| ----------------------------------------------------- | -------- | ---------------------------------------------- |
| `GET /api/license-keys`                               | 410 Gone | Use `GET /api/customers/me/entitlements`       |
| `GET /api/license-keys/:id`                           | 410 Gone | Use `GET /api/customers/me/entitlements`       |
| `POST /api/license-keys/:id/generate-activation-code` | 410 Gone | Use `POST /api/licence/activate` with deviceId |
| `POST /api/license-keys/:id/deactivate-with-code`     | 410 Gone | Use `POST /api/licence/deactivate`             |
| `POST /api/license/activate`                          | 410 Gone | Use `POST /api/licence/activate`               |
| `POST /api/license/deactivate`                        | 410 Gone | Use `POST /api/licence/deactivate`             |

### ✅ Active Endpoints (Stage 4/5 System)

| Endpoint                              | Purpose                                                     |
| ------------------------------------- | ----------------------------------------------------------- |
| `GET /api/customers/me/entitlements`  | List customer entitlements (includes `leaseRequired` field) |
| `GET /api/customers/me/devices`       | List customer's registered devices                          |
| `POST /api/device/register`           | Register a new device                                       |
| `POST /api/licence/activate`          | Activate entitlement on device                              |
| `POST /api/licence/refresh`           | Refresh lease token (subscriptions)                         |
| `POST /api/licence/deactivate`        | Deactivate device from entitlement                          |
| `POST /api/licence/offline-challenge` | Generate offline challenge token (subscriptions only)       |
| `POST /api/licence/offline-refresh`   | Redeem challenge for lease token (subscriptions only)       |

### 🎯 Subscription-Only Offline Refresh (v1 Policy)

**Offline lease refresh is only available for subscription entitlements.** Lifetime/Founders licenses are online-only and do not need lease tokens.

| Entitlement Type      | `leaseRequired` | Offline Refresh  | Notes                              |
| --------------------- | --------------- | ---------------- | ---------------------------------- |
| Subscription (Stripe) | `true`          | ✅ Supported     | Requires 7-day lease token renewal |
| Lifetime/Founders     | `false`         | ❌ Not Supported | Online-only, no lease needed       |

**Backend Behavior:**

- `POST /api/licence/offline-challenge` returns **400** with code `LIFETIME_NOT_SUPPORTED` for lifetime entitlements
- `POST /api/licence/offline-refresh` returns **400** with code `LIFETIME_NOT_SUPPORTED` for lifetime entitlements
- Frontend hides Offline Refresh section entirely if user has no subscription entitlements

**Rationale:**

- Lifetime/Founders customers get perpetual online-only access (simpler model)
- Subscription customers need lease tokens for offline grace period validation
- This simplifies the v1 offline flow while covering the primary use case (subscription users on air-gapped machines)

### 🔄 Backend Changes

1. **Controllers Modified**:
   - `backend/src/api/license-key/controllers/license-key.js` - All methods now return 410 Gone
   - `backend/src/api/custom/controllers/custom.js` - Added `licenseActivateLegacyRetired()` and `licenseDeactivateLegacyRetired()` handlers

2. **Routes Modified**:
   - `backend/src/api/license-key/routes/license-key.js` - Routes point to retired handlers
   - `backend/src/api/custom/routes/custom.js` - Legacy activation routes point to retired handlers

3. **Entitlements Response Enhanced**:
   - `GET /api/customers/me/entitlements` now includes `leaseRequired: boolean` computed server-side
   - `leaseRequired: false` for lifetime/founders entitlements (no refresh needed)
   - `leaseRequired: true` for subscription entitlements (require periodic refresh)

### 🖥️ Portal UI Changes (Stage 5.5)

> **Summary:** Legacy MAC-based UI was removed. Only Stage 4/5 device-based UI remains.

1. **Removed (no longer exists)**:
   - Legacy license keys card
   - MAC-based activation modal
   - Legacy offline deactivation modal

2. **Removed JavaScript Functions**:
   - `displayLicenseKeys()`, `updateStats()`
   - `openGenerateActivationModal()`, `proceedToActivation()`
   - `generateActivationCodeWithMac()`, `submitDeactivation()`
   - All MAC address helper functions

3. **Unchanged (Still Active)**:
   - Device Activations section (Stage 4 system)
   - Offline Refresh section (Stage 5 system)
   - All Stage 4/5 modals and functions

### 📜 Migration Script

A migration script is available to convert legacy license keys to entitlements:

```bash
# Dry run (preview only)
node scripts/migrate-legacy-keys-to-entitlements.js --dry-run

# Apply migration
node scripts/migrate-legacy-keys-to-entitlements.js --apply

# Migrate specific customer
node scripts/migrate-legacy-keys-to-entitlements.js --apply --email user@example.com
```

**Migration Logic**:

- Maps license type to tier: `maker` → `maker`, `pro` → `pro`
- Founders/lifetime status based on purchase date (before 2026-01-11)
- Creates entitlement with `source: 'legacy_migration'`
- Marks migrated licenses with `metadata.migratedAt` timestamp
- Idempotent: skips already-migrated licenses

### 🧪 Smoke Test

A comprehensive smoke test validates the cutover:

```bash
source docs/api/http/use-local-env.sh
./scripts/stage5-cutover-smoke-test.sh
```

**Tests Performed**:

1. Customer login
2. Legacy endpoints return 410 Gone
3. Entitlements endpoint returns `leaseRequired` field
4. Device registration works
5. Licence activation works
6. Licence refresh works
7. Offline challenge/response works
8. Licence deactivation works
9. Offline challenge rejects lifetime entitlements (400)
10. Offline refresh replay protection (409 on reuse)

### 📋 Founders/Lifetime Entitlements

"Founders" and "Lifetime" are the same thing from an entitlement perspective:

- `isLifetime: true` in the entitlement record
- `leaseRequired: false` in API responses
- Never require `/api/licence/refresh` calls
- **Online-only:** Cannot use offline challenge/refresh endpoints (returns 400)
- Desktop app should skip heartbeat/refresh logic for these

---

## Changelog (2026-01-21 Portal UI Fixes)

### 🐛 Bug Fixes (Portal UI)

- **FIXED**: Offline Refresh entitlement dropdown was empty - Added explicit `loadEntitlementsForStage45()` function that fetches and caches entitlements before populating dropdowns
- **FIXED**: Legacy section was showing subscription keys - Now filters to only show keys where `source === 'legacy_purchase'` or standalone legacy keys
- **FIXED**: Legacy section now hidden entirely when no legacy keys exist (starts with `hidden` class)
- **FIXED**: Offline Refresh section now hidden if user has no subscription entitlements (only lifetime/subscription with `leaseRequired !== false`)

### ✨ Improvements (Portal UI)

- **Offline Refresh Error Handling**:
  - Added inline error alert element (`#offline-error`) instead of browser alerts
  - Specific error messages for 401 (redirect to login), 403 (access denied), 409 (token already redeemed), 400 (invalid token)
  - Basic challenge token validation before API call

- **Copy Lease Token UX**:
  - Button now shows visual feedback (changes to "✓ Copied!" with success color for 2 seconds)
  - Added helper text explaining to copy token to offline machine
  - Changed button style to `btn-secondary` with clipboard emoji

- **Entitlement Dropdown Labels**: Now show `TIER • Subscription (status)` format for clarity

- **Removed fetch() interceptor**: Entitlements are now loaded explicitly via `loadEntitlementsForStage45()` instead of intercepting fetch calls

---

## Changelog (2026-01-20 Stage 4)

### ➕ Added Items (Stage 4: Device-Based Activation)

- **New Device schema fields**: `deviceName`, `publicKeyHash`, `deactivatedAt`
- **Expanded Device status enum**: `active`, `blocked`, `revoked`, `deactivated`
- **New endpoints** (all use customer-auth + license-rate-limit):
  - `POST /api/device/register` - Register a device for the authenticated customer
  - `POST /api/licence/activate` - Activate entitlement on a device (enforces maxDevices)
  - `POST /api/licence/refresh` - Heartbeat/refresh binding (updates lastSeenAt)
  - `POST /api/licence/deactivate` - Unbind device from entitlement
- **New audit events**: `device_register`, `device_activate`, `device_refresh`, `device_deactivate`
- **Device identity**: Uses `deviceId` + `publicKey` (no MAC address)
- **Binding model**: Device record itself serves as binding (has `entitlement` relation, `boundAt`, `lastSeenAt`)
- **maxDevices enforcement**: Prevents activating more devices than allowed per entitlement

### 🐛 Bug Fixes (Stage 4 Verification - 2026-01-20)

- **FIXED**: `custom/controllers/custom.js:1165` had `pro: 2` in fallback maxDevices mapping. Changed to `pro: 1` to match canonical TIER_CONFIG.

---

## Changelog (2026-01-20 Stage 5)

### ➕ Added Items (Stage 5: Lease Tokens + Offline Refresh)

- **Lease Token System**:
  - Subscription entitlements now receive 7-day signed lease tokens on refresh
  - Lifetime/founders entitlements return `leaseRequired: false` (no token needed)
  - Lease tokens are RS256-signed JWTs with: `entitlementId`, `customerId`, `deviceId`, `tier`, `exp`, `jti`
  - Configure TTL via `LEASE_TOKEN_TTL_SECONDS` env (default: 604800 = 7 days)
  - Requires `JWT_PUBLIC_KEY` env for verification

- **Updated `/api/licence/refresh`**:
  - Now returns `leaseToken`, `leaseExpiresAt`, `leaseRequired`, `serverTime` for subscriptions
  - Lifetime entitlements get `leaseRequired: false, leaseToken: null`

- **New Offline Refresh Endpoints**:
  - `POST /api/licence/offline-challenge` - Generate challenge token (customer-auth)
  - `POST /api/licence/offline-refresh` - Redeem challenge for lease token (customer-auth)
  - `POST /api/licence/verify-lease` - Debug endpoint to verify lease tokens

- **Replay Protection**:
  - New `offline-challenge` content-type stores used challenge `jti` values
  - Replay attempts return 409 Conflict

- **New Audit Events**:
  - `lease_issued` - When lease token is minted (online refresh)
  - `offline_challenge` - Challenge generation attempts
  - `offline_refresh` - Challenge redemption attempts (success/failure/replay)

- **New Utils**:
  - `backend/src/utils/lease-token.js` - `mintLeaseToken()`, `verifyLeaseToken()`, `mintOfflineChallenge()`, `verifyOfflineChallenge()`

---

## Changelog (2026-01-20 Portal UI)

### ➕ Added Items (Stage 4/5 Portal UI)

- **New Backend Endpoint**:
  - `GET /api/customers/me/devices` - List customer's registered devices with entitlement bindings
  - Returns: `{ devices: [{ id, deviceId, name, platform, lastSeen, entitlement, isActivated }], meta: { total, activatedCount } }`

- **New Portal Sections** (`frontend/src/pages/customer/dashboard.astro`):
  1. **Device Activations (New System)** - Table showing registered devices with:
     - Register Device button + modal
     - Device list with platform icons, status badges, last seen timestamp
     - Per-device actions: Activate, Refresh, Deactivate
  2. **Offline Refresh (Factory Machines)** - Form for air-gapped devices:
     - Select entitlement and device dropdowns
     - Challenge token input textarea
     - Redeem button → displays lease token with expiry details
     - Copy-to-clipboard functionality

- **New Modals**:
  - `register_device_modal` - Device ID, name (optional), platform (optional)
  - `activate_device_modal` - Select entitlement from active ones
  - `deactivate_device_modal` - Confirmation with device/entitlement info
  - `refresh_device_modal` - Manual refresh/heartbeat trigger

> **Note:** Legacy "License Keys" section was removed entirely in Stage 5.5.

- **JavaScript Functions Added**:
  - `loadDevices()` - Fetch and cache customer devices
  - `renderDevicesList()` - Display devices table
  - `openActivateDeviceModal()`, `openDeactivateDeviceModal()`, `openRefreshDeviceModal()` - Modal handlers
  - `populateOfflineDropdowns()` - Fill entitlement/device selects for offline refresh
  - `showLeaseTokenResult()` - Display generated lease token
  - `copyLeaseToken()`, `resetOfflineRefresh()` - UI utilities

### 🔮 Stage 6+ TODOs (Not Yet Implemented)

- Device-side signature verification (nonce signing)
- Offline deactivation code verification (cryptographic proof)
- Desktop app integration with lease token storage

---

## Changelog (2026-01-19 Stage 3)

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

## How Activation Works (Human Overview)

> **This section explains the active activation flows.**

### Overview Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ACTIVATION FLOW OVERVIEW                        │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  Stage 4: Online Device Activation ✅ ACTIVE                           │
│  ─────────────────────────────────────────────────────────────────     │
│  Desktop App → Register Device → Activate Entitlement → Refresh        │
│  Uses: device.deviceId + device.publicKeyHash, device↔entitlement      │
│  Endpoints: /api/device/register, /api/licence/activate, refresh, etc  │
│                                                                        │
│  Stage 5: Subscription Lease Tokens ✅ ACTIVE                          │
│  ─────────────────────────────────────────────────────────────────     │
│  Online: /api/licence/refresh → returns leaseToken (7-day JWT)         │
│  Offline: /api/licence/offline-challenge + offline-refresh             │
│  Uses: RS256-signed JWT, replay protection via offline-challenge jti   │
│                                                                        │
│  Legacy (Retired) ❌                                                   │
│  ─────────────────────────────────────────────────────────────────     │
│  POST /api/license/activate → 410 Gone                                 │
│  POST /api/license/deactivate → 410 Gone                               │
│  Migration: scripts/migrate-legacy-keys-to-entitlements.cjs            │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Stage 4: Device-Based Activation (Online)

**When used:** All new activations. Desktop app communicates directly with backend.

**What is `deviceId`?**

> ⚠️ **IMPORTANT:** `deviceId` is NOT a MAC address! It's a stable machine identifier generated by the desktop app (e.g., UUID, hardware fingerprint). The desktop app owns the format.

**How it works:**

1. Desktop app generates a stable `deviceId` and optional keypair
2. App calls `POST /api/device/register` with `deviceId` + `publicKey`
3. User selects which entitlement to activate
4. App calls `POST /api/licence/activate` with `entitlementId` + `deviceId`
5. Backend checks `maxDevices` limit, binds device to entitlement
6. App periodically calls `POST /api/licence/refresh` as heartbeat

**Key data:**

- `device.deviceId` — Stable identifier from desktop app
- `device.publicKeyHash` — SHA256 of public key (for future signature verification)
- `device.entitlement` — Relation to bound entitlement
- `device.boundAt`, `device.lastSeenAt` — Timestamps

**maxDevices per tier (verified in `utils/entitlement-mapping.js:128-145`):**
| Tier | maxDevices |
|------------|------------|
| maker | 1 |
| pro | 1 |
| education | 5 |
| enterprise | 10 |

**Verified in code:** `custom/controllers/custom.js:2580-3180` (deviceRegister, licenceActivate, licenceRefresh, licenceDeactivate)

### Stage 5: Lease Tokens (Subscriptions Only)

**When used:** Subscription entitlements need periodic verification. Lifetime/founders skip this.

**How it works (online):**

1. Desktop app calls `POST /api/licence/refresh`
2. Backend checks if `entitlement.isLifetime`:
   - **If true:** Returns `leaseRequired: false` (no token needed)
   - **If false:** Mints 7-day RS256-signed lease token
3. Desktop app stores lease token, uses it for offline validation

**How it works (offline/air-gapped):**

1. Admin generates challenge via portal: `POST /api/licence/offline-challenge`
2. Admin copies challenge token to USB, brings to air-gapped machine
3. Air-gapped app displays challenge
4. Admin brings response back, redeems via `POST /api/licence/offline-refresh`
5. Backend validates challenge, mints lease token
6. Admin copies lease token to air-gapped machine

**Lease token payload (JWT):**

```json
{
  "sub": "entitlementId",
  "customerId": 123,
  "deviceId": "stable-device-id",
  "tier": "pro",
  "iat": 1705862400,
  "exp": 1706467200,
  "jti": "unique-token-id"
}
```

**Replay protection:**

- Challenge tokens have unique `jti` values
- Used `jti` values stored in `offline-challenge` content-type
- Replay attempts return `409 Conflict`

**Verified in code:** `custom/controllers/custom.js:2968-3420` (licenceRefresh with lease minting), `utils/lease-token.js`

### What You Should See in the Portal UI

**1. Device Activations (New System)** — Top section

- Register Device button + modal
- Table of registered devices: name, platform, status, last seen
- Per-device actions: Activate, Refresh, Deactivate

**2. Offline Refresh (Factory Machines)** — Middle section

- Dropdown: Select entitlement (only shows subscriptions where `leaseRequired !== false`)
- Dropdown: Select device (only shows devices bound to selected entitlement)
- Textarea: Paste challenge token
- Button: Redeem → shows lease token + expiry + copy button
- Note: Section hidden if user has no subscription entitlements

> **Note:** Legacy "License Keys" section was removed in Stage 5.5. All activation uses Stage 4/5 device-based system.

**Verified in code:** `dashboard.astro` (loadEntitlementsForStage45), `dashboard.astro` (populateOfflineDropdowns)

---

## Stage Boundaries (What's Implemented vs Planned)

> **⚠️ CRITICAL:** Read this before assuming any feature exists.

### ✅ Stage 4: Device-Based Activation (IMPLEMENTED)

| Feature                                                       | Status         | Evidence                        |
| ------------------------------------------------------------- | -------------- | ------------------------------- |
| Device registration (`/api/device/register`)                  | ✅ Implemented | `custom.js:2580-2680`           |
| Device activation (`/api/licence/activate`)                   | ✅ Implemented | `custom.js:2700-2960`           |
| Device refresh (`/api/licence/refresh`)                       | ✅ Implemented | `custom.js:2968-3180`           |
| Device deactivation (`/api/licence/deactivate`)               | ✅ Implemented | `custom.js:3184-3330`           |
| maxDevices enforcement                                        | ✅ Implemented | `custom.js:2895-2915`           |
| Audit events (device_register, activate, refresh, deactivate) | ✅ Implemented | Throughout controller           |
| Rate limiting (10 req/min)                                    | ✅ Implemented | `license-rate-limit` middleware |

### ✅ Stage 5: Lease Tokens (IMPLEMENTED)

| Feature                               | Status         | Evidence                                |
| ------------------------------------- | -------------- | --------------------------------------- |
| Lease token minting for subscriptions | ✅ Implemented | `custom.js:3125-3145`, `lease-token.js` |
| `leaseRequired: false` for lifetime   | ✅ Implemented | `custom.js:3118-3125`                   |
| Offline challenge generation          | ✅ Implemented | `custom.js:3336-3420`                   |
| Offline challenge redemption          | ✅ Implemented | `custom.js:3422-3540`                   |
| Replay protection (jti storage)       | ✅ Implemented | `offline-challenge` content-type        |
| Portal UI for offline refresh         | ✅ Implemented | `dashboard.astro:3150-3300`             |

### ❌ NOT Implemented (Planned for Future Stages)

| Feature                                       | Status     | Notes                                 |
| --------------------------------------------- | ---------- | ------------------------------------- |
| Device signature verification (nonce signing) | ❌ Planned | `nonce` param logged but not enforced |
| Cryptographic offline deactivation code       | ❌ Planned | Currently uses DB lookup only         |
| Desktop app integration with lease storage    | ❌ Planned | API ready, desktop app needs update   |

---

## Quick Troubleshooting

### "Why does Offline Refresh show no entitlements?"

**Possible causes:**

1. **User has no subscription entitlements** — Offline refresh only applies to subscriptions, not lifetime/founders
2. **Entitlement is inactive** — Check `entitlement.status` in admin
3. **API not loading** — Check browser console for 401/403 errors

**How to verify:** Check `loadEntitlementsForStage45()` response in browser DevTools Network tab.

### "Why do subscription keys appear under Legacy section?"

**They shouldn't.** The Legacy section filters to `entitlement.source === 'legacy_purchase'` only.

**If they do appear:**

- Check the entitlement's `source` field in Strapi admin
- New purchases from webhooks should have `source: 'stripe_checkout'`
- Only manually-created or migrated keys should have `source: 'legacy_purchase'`

**Verified in code:** `dashboard.astro:1773-1785` (legacyKeys filter)

### "Why do I see multiple Pro items in dropdowns?"

**This is expected!** A customer can have:

- **Pro (Founders)** — One-time purchase during founders sale, `isLifetime: true`
- **Pro (Subscription)** — Monthly/annual subscription, `isLifetime: false`

Both are valid entitlements. The dropdown shows `TIER • type (status)` to distinguish them.

### "Device shows 'not activated' but I activated it"

**Possible causes:**

1. **Activated on different entitlement** — Each device↔entitlement binding is separate
2. **Deactivated since** — Check `device.deactivatedAt` timestamp
3. **maxDevices limit hit** — Another device took the slot

**How to verify:** Call `GET /api/customers/me/devices` and check the `entitlement` field on the device.

### "Offline challenge returns 409 Conflict"

**Cause:** Challenge token was already redeemed (replay protection).

**Solution:** Generate a new challenge token via the portal. Each challenge can only be redeemed once.

**Verified in code:** `custom.js:3480-3500` (replay check)

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

| Variable                            | Usage                                      | File:Line                                                                    |
| ----------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`                 | Stripe API authentication                  | `custom/controllers/custom.js:1`                                             |
| `STRIPE_WEBHOOK_SECRET`             | Webhook signature verification             | `custom/controllers/custom.js:~278`                                          |
| `JWT_SECRET`                        | Customer token signing (HS256)             | `customer/controllers/customer.js:92,170`, `middlewares/customer-auth.js:13` |
| `JWT_PRIVATE_KEY`                   | License token signing (RS256)              | `utils/jwt-keys.js:16`, `custom/controllers/custom.js:~1117`                 |
| `JWT_PUBLIC_KEY`                    | Lease token verification                   | `utils/lease-token.js:50,131,221`                                            |
| `JWT_ISSUER`                        | JWT issuer claim                           | `custom/controllers/custom.js:~1089`                                         |
| `LEASE_TOKEN_TTL_SECONDS`           | Lease token TTL (default: 604800 = 7 days) | `utils/lease-token.js:38`                                                    |
| `NODE_ENV`                          | Dev mode checks                            | Multiple files                                                               |
| `FOUNDERS_SALE_END_ISO`             | Founders sale end override                 | `utils/entitlement-mapping.js:86-95` (default: 2026-01-11T23:59:59Z)         |
| `ADMIN_INTERNAL_TOKEN`              | Admin endpoint protection                  | `middlewares/admin-internal.js:14`                                           |
| `STRIPE_PRICE_ID_MAKER_ONETIME`     | Stripe price ID for maker tier             | `custom/controllers/custom.js:27`, `stripe-webhook-handler.js:150`           |
| `STRIPE_PRICE_ID_PRO_ONETIME`       | Stripe price ID for pro tier               | `custom/controllers/custom.js:34`, `stripe-webhook-handler.js:151`           |
| `STRIPE_PRICE_ID_MAKER_SUB_MONTHLY` | Maker subscription price                   | `custom/controllers/custom.js:42`, `stripe-webhook-handler.js:152`           |
| `STRIPE_PRICE_ID_PRO_SUB_MONTHLY`   | Pro subscription price                     | `custom/controllers/custom.js:48`, `stripe-webhook-handler.js:153`           |

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
| `jti`                | string   | -        | -          | **Historical** - JWT ID for legacy activation        |
| `machineId`          | string   | -        | -          | **Historical** - Legacy MAC/fingerprint (not used)   |
| `typ`                | enum     | -        | `"paid"`   | `["trial", "paid", "starter", "pro", "enterprise"]`  |
| `trialStart`         | datetime | -        | -          |                                                      |
| `isUsed`             | boolean  | -        | `false`    | **Historical** - Legacy field                        |
| `deviceInfo`         | json     | -        | -          | **Historical** - Legacy device info                  |
| `activatedAt`        | datetime | -        | -          |                                                      |
| `expiresAt`          | datetime | -        | -          |                                                      |
| `maxActivations`     | integer  | -        | `1`        | **Historical** - Use entitlement.maxDevices instead  |
| `currentActivations` | integer  | -        | `0`        | **Historical** - Use device count instead            |
| `deactivationCode`   | text     | -        | -          | **Historical** - Legacy deactivation code            |
| `activationNonce`    | string   | -        | -          | **Historical** - Legacy offline nonce                |

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
| `maxDevices`           | integer  | -        | `1`                 | Tier-based: maker=1, pro=1, edu=5, ent=10       |
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
| pro        | 1          | Professional use         |
| education  | 5          | Educational institutions |
| enterprise | 10         | Enterprise deployments   |

**Note:** maxDevices defaults to 1 for Maker/Pro tiers. Higher tiers (Education/Enterprise) get more devices by default. Entitlements can override this value explicitly if needed.

**Evidence:** `backend/src/utils/entitlement-mapping.js:128-145` (TIER_CONFIG)

**Founders Sale Window:**

Purchases made during the founders sale window (2024-01-01 to 2026-01-11) get `isLifetime: true`.
Override via `FOUNDERS_SALE_END_ISO` environment variable.

---

## 2. Public Surfaces (Routes)

### Customer Portal Routes (ACTIVE)

| Method | Path                                             | Auth            | Handler                   | Evidence                                 |
| ------ | ------------------------------------------------ | --------------- | ------------------------- | ---------------------------------------- |
| POST   | `/api/customers/register`                        | auth-rate-limit | `customer.register`       | `customer/routes/customer.js:5-12`       |
| POST   | `/api/customers/login`                           | auth-rate-limit | `customer.login`          | `customer/routes/customer.js:14-21`      |
| GET    | `/api/customers/me`                              | customer-auth   | `customer.me`             | `customer/routes/customer.js:22-29`      |
| PUT    | `/api/customers/profile`                         | customer-auth   | `customer.updateProfile`  | `customer/routes/customer.js:30-37`      |
| PUT    | `/api/customers/password`                        | customer-auth   | `customer.changePassword` | `customer/routes/customer.js:38-45`      |
| GET    | `/api/customers/entitlements`                    | customer-auth   | `customer.entitlements`   | `customer/routes/customer.js:47-54`      |
| GET    | `/api/license-keys`                              | customer-auth   | **RETIRED → 410 Gone**    | Use `GET /api/customers/me/entitlements` |
| GET    | `/api/license-keys/:id`                          | customer-auth   | **RETIRED → 410 Gone**    | Use `GET /api/customers/me/entitlements` |
| POST   | `/api/license-keys/:id/generate-activation-code` | customer-auth   | **RETIRED → 410 Gone**    | Use `POST /api/licence/activate`         |
| POST   | `/api/license-keys/:id/deactivate-with-code`     | customer-auth   | **RETIRED → 410 Gone**    | Use `POST /api/licence/deactivate`       |

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

### Desktop App License API (RETIRED - Legacy MAC-based)

> **⚠️ RETIRED:** These endpoints return HTTP 410 Gone. Use Stage 4/5 endpoints below instead.

| Method | Path                      | Auth               | Status              | Migration                          |
| ------ | ------------------------- | ------------------ | ------------------- | ---------------------------------- |
| POST   | `/api/license/activate`   | license-rate-limit | **410 Gone**        | Use `POST /api/licence/activate`   |
| POST   | `/api/license/deactivate` | license-rate-limit | **410 Gone**        | Use `POST /api/licence/deactivate` |
| POST   | `/api/license/reset`      | admin-internal     | Admin tool (active) | Internal use only                  |

### Stage 4: Device-Based Activation API (NEW)

These endpoints use customer auth + deviceId (not MAC-based legacy activation):

| Method | Path                      | Auth                               | Handler                    | Description                        |
| ------ | ------------------------- | ---------------------------------- | -------------------------- | ---------------------------------- |
| POST   | `/api/device/register`    | customer-auth + license-rate-limit | `custom.deviceRegister`    | Register device for customer       |
| POST   | `/api/licence/activate`   | customer-auth + license-rate-limit | `custom.licenceActivate`   | Activate entitlement on device     |
| POST   | `/api/licence/refresh`    | customer-auth + license-rate-limit | `custom.licenceRefresh`    | Refresh binding (heartbeat)        |
| POST   | `/api/licence/deactivate` | customer-auth + license-rate-limit | `custom.licenceDeactivate` | Deactivate entitlement from device |

**Note:** The new `/api/licence/*` endpoints (with `c`) are separate from legacy `/api/license/*` (with `s`).

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

| System                        | Controller       | Routes File                         | Status                   |
| ----------------------------- | ---------------- | ----------------------------------- | ------------------------ |
| **Stage 4/5 Device-Based**    | `custom.js`      | `custom/routes/custom.js`           | **ACTIVE** (all clients) |
| **Legacy MAC-Based (Portal)** | `license-key.js` | `license-key/routes/license-key.js` | **RETIRED** (410 Gone)   |
| **Legacy MAC-Based (App)**    | `custom.js`      | `custom/routes/custom.js`           | **RETIRED** (410 Gone)   |

### Rate Limiting

**Stage 4/5 endpoints** (`/api/licence/activate`, `/api/licence/deactivate`, `/api/licence/refresh`) are protected by:

- Standard Strapi rate limiting
- Customer-auth middleware (authenticated endpoints)

---

### System A: Legacy MAC-Based Activation ❌ RETIRED (Stage 5.5)

> **These endpoints return HTTP 410 Gone with migration guidance.**
> **All activation now uses the Stage 4/5 device-based system (see System B below).**

**Retired Endpoints:**

- `POST /api/license-keys/:id/generate-activation-code` → 410 Gone
- `POST /api/license-keys/:id/deactivate-with-code` → 410 Gone
- `POST /api/license/activate` → 410 Gone
- `POST /api/license/deactivate` → 410 Gone

**Migration Path:**

1. Customers with legacy license keys should use the migration script
2. Desktop apps should use Stage 4/5 device-based activation
3. See `scripts/migrate-legacy-keys-to-entitlements.js` for bulk migration

---

### System B: Stage 4/5 Device-Based Activation (ACTIVE)

**Used by:** Desktop app and customer portal for all activation operations

#### Endpoint: Register Device

**Route:** `POST /api/device/register`  
**Controller:** `backend/src/api/custom/controllers/custom.js`  
**Auth:** customer-auth middleware

**Request:**

```json
{
  "deviceId": "stable-unique-device-id",
  "publicKey": "base64-encoded-public-key",
  "name": "My MacBook Pro",
  "platform": "macos"
}
```

**Response:**

```json
{
  "device": {
    "id": 123,
    "deviceId": "stable-unique-device-id",
    "name": "My MacBook Pro",
    "platform": "macos",
    "publicKeyHash": "sha256-of-public-key"
  }
}
```

#### Endpoint: Activate Entitlement on Device

**Route:** `POST /api/licence/activate`  
**Controller:** `backend/src/api/custom/controllers/custom.js`  
**Auth:** customer-auth middleware

**Request:**

```json
{
  "entitlementId": 456,
  "deviceId": "stable-unique-device-id"
}
```

**Response:**

```json
{
  "success": true,
  "device": { "id": 123, "boundAt": "2026-01-20T..." },
  "entitlement": { "id": 456, "tier": "pro" }
}
```

**Validation:**

1. Device must be registered and belong to authenticated customer
2. Entitlement must belong to authenticated customer and be active
3. Device count must be under `maxDevices` for entitlement tier

#### Endpoint: Refresh (Lease Token for Subscriptions)

**Route:** `POST /api/licence/refresh`  
**Controller:** `backend/src/api/custom/controllers/custom.js`  
**Auth:** customer-auth middleware

**Request:**

```json
{
  "deviceId": "stable-unique-device-id"
}
```

**Response (subscription):**

```json
{
  "leaseRequired": true,
  "leaseToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-01-27T..."
}
```

**Response (lifetime/founders):**

```json
{
  "leaseRequired": false,
  "message": "Lifetime entitlements do not require lease tokens"
}
```

#### Endpoint: Deactivate Device

**Route:** `POST /api/licence/deactivate`  
**Controller:** `backend/src/api/custom/controllers/custom.js`  
**Auth:** customer-auth middleware

**Request:**

```json
{
  "deviceId": "stable-unique-device-id"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Device deactivated"
}
```

#### Endpoint: Offline Challenge (Subscriptions Only)

**Route:** `POST /api/licence/offline-challenge`  
**Controller:** `backend/src/api/custom/controllers/custom.js`  
**Auth:** customer-auth middleware

**Request:**

```json
{
  "entitlementId": 456,
  "deviceId": "stable-unique-device-id"
}
```

**Response:**

```json
{
  "challengeToken": "base64-encoded-challenge-jwt",
  "expiresAt": "2026-01-21T..."
}
```

**Note:** Returns 400 with `LIFETIME_NOT_SUPPORTED` for lifetime entitlements.

#### Endpoint: Offline Refresh (Subscriptions Only)

**Route:** `POST /api/licence/offline-refresh`  
**Controller:** `backend/src/api/custom/controllers/custom.js`  
**Auth:** customer-auth middleware

**Request:**

```json
{
  "challengeResponse": "base64-encoded-response-from-app"
}
```

**Response:**

```json
{
  "leaseToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-01-27T..."
}
```

**Note:** Returns 400 with `LIFETIME_NOT_SUPPORTED` for lifetime entitlements.

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

**Location:** `backend/src/utils/entitlement-mapping.js:128-145`

| Tier       | maxDevices | Price IDs           |
| ---------- | ---------- | ------------------- |
| maker      | 1          | `price_starter*`    |
| pro        | 1          | `price_pro*`        |
| education  | 5          | Manual assignment   |
| enterprise | 10         | `price_enterprise*` |

**Note:** maxDevices defaults to 1 for Maker/Pro tiers (single device per license).

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

| Page      | Path                  | API Calls                                                                                                                     | Evidence          |
| --------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Login     | `/customer/login`     | `POST /api/customers/login`                                                                                                   | `login.astro`     |
| Register  | `/customer/register`  | `POST /api/customers/register`                                                                                                | `register.astro`  |
| Dashboard | `/customer/dashboard` | `GET /api/customers/me`, `GET /api/customers/me/entitlements`, `GET /api/customers/me/devices`, `POST /api/customer-checkout` | `dashboard.astro` |
| Profile   | `/customer/profile`   | `GET /api/customers/me`, `PUT /api/customers/profile`, `PUT /api/customers/password`                                          | `profile.astro`   |
| Success   | `/customer/success`   | `GET /api/customer/purchase-status` (polling)                                                                                 | `success.astro`   |

### Dashboard Entitlements Display (Stage 4/5)

1. Calls `GET /api/customers/me/entitlements` with customer token
2. Response includes: `{ entitlements: [{ id, tier, isLifetime, leaseRequired, expiresAt, devices }] }`
3. Shows device activation status, tier, and offline refresh availability

### Dashboard Devices Display (Stage 4/5)

1. Calls `GET /api/customers/me/devices` with customer token
2. Response includes: `{ devices: [{ id, deviceId, name, platform, lastSeen, entitlement }] }`
3. Shows bound devices per entitlement with deactivation controls

### Offline Refresh Flow (Subscriptions Only)

1. Portal shows "Offline Refresh" section only if user has subscription entitlements (`leaseRequired: true`)
2. Admin generates challenge via `POST /api/licence/offline-challenge`
3. Challenge token copied to air-gapped machine
4. Response brought back, redeemed via `POST /api/licence/offline-refresh`
5. Lease token returned for offline validation

> **Note:** Offline refresh is disabled for lifetime/founders entitlements (`leaseRequired: false`)

### What Was Removed in Stage 5.5

> **Historical note:** The following dashboard sections no longer exist.

- Legacy license keys card
- Legacy activation modal
- Legacy offline deactivation modal

---

## 8. Desktop App Expectations (from Portal POV)

> **Note:** This section documents the Stage 4/5 device-based API that the desktop app should use.
> **Legacy MAC-based endpoints (`/api/license/activate`, `/api/license/deactivate`) return 410 Gone.**

### Device Registration

**URL:** `POST /api/device/register`  
**Auth:** Customer JWT required

**Request:**

```json
{
  "deviceId": "stable-unique-device-id",
  "publicKey": "base64-encoded-public-key",
  "name": "Device Name",
  "platform": "macos|windows|linux"
}
```

**Success Response (200):**

```json
{
  "device": {
    "id": 123,
    "deviceId": "stable-unique-device-id",
    "name": "Device Name",
    "platform": "macos",
    "publicKeyHash": "sha256-of-public-key"
  }
}
```

### Activation Endpoint

**URL:** `POST /api/licence/activate`  
**Auth:** Customer JWT required

**Request:**

```json
{
  "entitlementId": 456,
  "deviceId": "stable-unique-device-id"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "device": { "id": 123, "boundAt": "2026-01-20T..." },
  "entitlement": { "id": 456, "tier": "pro" }
}
```

**Error Responses:**

- 400: `{ "error": "Device not found or not registered" }`
- 400: `{ "error": "Entitlement not found or not active" }`
- 400: `{ "error": "Device limit reached for this entitlement" }`

### Refresh Endpoint (Lease Token for Subscriptions)

**URL:** `POST /api/licence/refresh`  
**Auth:** Customer JWT required

**Request:**

```json
{
  "deviceId": "stable-unique-device-id"
}
```

**Success Response (200) - Subscription:**

```json
{
  "leaseRequired": true,
  "leaseToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-01-27T..."
}
```

**Success Response (200) - Lifetime:**

```json
{
  "leaseRequired": false,
  "message": "Lifetime entitlements do not require lease tokens"
}
```

### Deactivation Endpoint

**URL:** `POST /api/licence/deactivate`  
**Auth:** Customer JWT required

**Request:**

```json
{
  "deviceId": "stable-unique-device-id"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "Device deactivated"
}
```

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

### ~~GAP-003: Multiple Activation Systems with Different machineId Handling~~ (RETIRED)

**Status:** ✅ RESOLVED in Stage 5.5

Legacy MAC-based activation systems have been retired. All activation now uses Stage 4/5 device-based system with `deviceId` (not MAC address). The legacy `license-key.js` and `custom.js` MAC-based endpoints return 410 Gone.

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

| File                                                     | Purpose                                                          |
| -------------------------------------------------------- | ---------------------------------------------------------------- |
| `backend/src/api/custom/routes/custom.js`                | Checkout, webhook, device, licence API routes                    |
| `backend/src/api/custom/controllers/custom.js`           | Main controller for payments, device registration, Stage 4/5 ops |
| `backend/src/utils/stripe-webhook-handler.js`            | Server-truth webhook processing with idempotency                 |
| `backend/src/utils/entitlement-mapping.js`               | Tier mapping and founders logic                                  |
| `backend/src/utils/lease-token.js`                       | RS256 lease token generation and validation                      |
| `backend/src/api/customer/routes/customer.js`            | Customer auth routes                                             |
| `backend/src/api/customer/controllers/customer.js`       | Customer registration, login, profile                            |
| `backend/src/api/license-key/routes/license-key.js`      | Legacy routes (return 410 Gone)                                  |
| `backend/src/api/license-key/controllers/license-key.js` | Legacy handlers (return 410 Gone)                                |
| `backend/src/middlewares/customer-auth.js`               | JWT verification for customer routes                             |
| `backend/src/middlewares/admin-internal.js`              | Admin token protection for internal routes                       |
| `frontend/src/pages/customer/dashboard.astro`            | Customer dashboard UI (Stage 4/5 device management)              |

---

## Stage 4: Device-Based Activation API

### Overview

Stage 4 introduces a clean, unified activation API that uses `deviceId` + `publicKey` for device identity (no MAC addresses). This system:

- Requires customer authentication (JWT token)
- Binds entitlements to devices with `maxDevices` enforcement
- Supports refresh (heartbeat) and deactivation
- Logs all actions via structured audit events
- Rate limits all endpoints (10 req/min/IP)

### ✅ Verified in Code (2026-01-20)

| Component                   | File:Line                                            | Status      |
| --------------------------- | ---------------------------------------------------- | ----------- |
| Device schema fields        | `api/device/content-types/device/schema.json`        | ✅ Complete |
| Routes (4 endpoints)        | `api/custom/routes/custom.js:213-253`                | ✅ Complete |
| Controllers (4 handlers)    | `api/custom/controllers/custom.js:2554-3263`         | ✅ Complete |
| Audit events (4 functions)  | `utils/audit-logger.js:209-265`                      | ✅ Complete |
| Rate limiting middleware    | `middlewares/license-rate-limit.js`                  | ✅ Applied  |
| Customer auth middleware    | `middlewares/customer-auth.js`                       | ✅ Applied  |
| maxDevices canonical config | `utils/entitlement-mapping.js:128-145` (TIER_CONFIG) | ✅ Verified |
| Device identity (no MAC)    | deviceId + publicKeyHash (no MAC addresses)          | ✅ Verified |
| maxDevices enforcement      | Checks activeDevices.length < maxDevices             | ✅ Verified |
| Ownership validation        | Entitlement belongs to auth'd customer               | ✅ Verified |

**Fixes Applied During Verification:**

- `api/custom/controllers/custom.js:1165`: Fixed fallback maxDevices mapping (`pro: 2` → `pro: 1`)

**maxDevices by Tier (Canonical Source: `utils/entitlement-mapping.js:128-145`):**
| Tier | maxDevices |
| ---------- | ---------- |
| maker | 1 |
| pro | 1 |
| education | 5 |
| enterprise | 10 |

---

## Stage 5: Lease Tokens + Offline Refresh (IMPLEMENTED)

### Overview

Stage 5 adds subscription-compatible offline support:

- **Subscriptions**: Receive 7-day signed lease tokens on refresh
- **Lifetime/Founders**: No lease required (`leaseRequired: false`) - valid forever
- **Offline machines**: Can refresh via manual challenge/response flow through portal

### Lease Token Details

| Property     | Value                                                                                |
| ------------ | ------------------------------------------------------------------------------------ |
| Algorithm    | RS256                                                                                |
| Default TTL  | 7 days (604800 seconds)                                                              |
| Env Override | `LEASE_TOKEN_TTL_SECONDS`                                                            |
| Claims       | `entitlementId`, `customerId`, `deviceId`, `tier`, `isLifetime`, `iat`, `exp`, `jti` |

### Online Refresh Flow

```
Desktop App → POST /api/licence/refresh → Server returns leaseToken + leaseExpiresAt
```

Response for subscriptions:

```json
{
  "ok": true,
  "status": "active",
  "leaseRequired": true,
  "leaseToken": "eyJhbG...",
  "leaseExpiresAt": "2026-01-27T12:00:00.000Z",
  "serverTime": "2026-01-20T12:00:00.000Z"
}
```

Response for lifetime:

```json
{
  "ok": true,
  "status": "active",
  "leaseRequired": false,
  "leaseToken": null,
  "leaseExpiresAt": null
}
```

### Manual Offline Refresh Flow (Challenge/Response)

For factory machines without internet, users can refresh via the portal:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Offline Machine │     │  Portal (User)   │     │     Server      │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         │ 1. Shows challenge    │                        │
         │    request screen     │                        │
         │<──────────────────────│                        │
         │                       │                        │
         │ 2. User copies info   │                        │
         │    to portal          │                        │
         │──────────────────────>│                        │
         │                       │                        │
         │                       │ 3. POST /offline-challenge
         │                       │───────────────────────>│
         │                       │                        │
         │                       │<───────────────────────│
         │                       │ 4. Returns challenge   │
         │                       │    token               │
         │                       │                        │
         │                       │ 5. POST /offline-refresh
         │                       │───────────────────────>│
         │                       │                        │
         │                       │<───────────────────────│
         │                       │ 6. Returns lease token │
         │                       │    (refreshCode)       │
         │                       │                        │
         │ 7. User pastes        │                        │
         │    refreshCode        │                        │
         │<──────────────────────│                        │
         │                       │                        │
         │ 8. Machine stores     │                        │
         │    lease, continues   │                        │
         └───────────────────────┴────────────────────────┘
```

**Step-by-step:**

1. **Offline machine** shows a "Refresh Needed" screen with `entitlementId` and `deviceId`
2. **User** logs into portal, navigates to license management
3. **User** clicks "Generate Offline Challenge" (portal calls `POST /api/licence/offline-challenge`)
4. **Server** returns a short-lived challenge token (10 min TTL)
5. **User** clicks "Redeem Challenge" (portal calls `POST /api/licence/offline-refresh`)
6. **Server** validates challenge, returns `refreshCode` (= lease token)
7. **User** copies `refreshCode` and pastes into offline machine
8. **Machine** stores the lease token and continues operating

### Replay Protection

- Each challenge has a unique `jti` (nonce)
- On redemption, the `jti` is stored in `offline-challenge` content-type
- Replay attempts (same challenge used twice) return **409 Conflict**
- Challenge tokens expire after 10 minutes

### Audit Events (Stage 5)

| Event               | Outcome | Reason Codes                                                                                                                                                                             |
| ------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lease_issued`      | success | `online_refresh`                                                                                                                                                                         |
| `offline_challenge` | success | `challenge_issued`                                                                                                                                                                       |
| `offline_challenge` | failure | `missing_fields`, `entitlement_not_found`, `not_owner`, `entitlement_not_active`, `device_not_found`, `device_not_owned`                                                                 |
| `offline_refresh`   | success | `lease_issued`, `lifetime_no_lease_needed`                                                                                                                                               |
| `offline_refresh`   | failure | `missing_challenge`, `challenge_expired`, `invalid_challenge`, `replay_rejected`, `entitlement_not_found`, `not_owner`, `entitlement_not_active`, `device_not_found`, `device_not_owned` |

### 🔮 Planned for Stage 6+ (NOT YET IMPLEMENTED)

- **Device signature verification** - Nonce signing with device private key
- **Offline deactivation codes** - Cryptographic proof for offline uninstall
- **Desktop app integration** - Store/manage lease tokens locally

### Device Schema

**File:** `backend/src/api/device/content-types/device/schema.json`

| Field         | Type     | Required | Description                                   |
| ------------- | -------- | -------- | --------------------------------------------- |
| deviceId      | string   | ✓        | Unique device identifier (uuid-like)          |
| deviceName    | string   |          | Human-readable device name                    |
| publicKey     | text     |          | Device's public key for future verification   |
| publicKeyHash | string   |          | SHA-256 hash of public key (first 16 chars)   |
| status        | enum     | ✓        | `active`, `blocked`, `revoked`, `deactivated` |
| customer      | relation |          | manyToOne → customer                          |
| entitlement   | relation |          | manyToOne → entitlement (binding)             |
| boundAt       | datetime |          | When device was bound to entitlement          |
| lastSeenAt    | datetime |          | Last heartbeat/refresh time                   |
| deactivatedAt | datetime |          | When device was deactivated                   |
| platform      | enum     |          | `windows`, `macos`, `linux`, `unknown`        |
| appVersion    | string   |          | App version on device                         |
| metadata      | json     |          | Additional metadata                           |

### Offline Challenge Schema (NEW - Stage 5)

**File:** `backend/src/api/offline-challenge/content-types/offline-challenge/schema.json`

| Field              | Type     | Required | Description                       |
| ------------------ | -------- | -------- | --------------------------------- |
| jti                | string   | ✓        | Challenge nonce (unique)          |
| entitlementId      | integer  | ✓        | Associated entitlement            |
| deviceId           | string   | ✓        | Associated device                 |
| customerId         | integer  |          | Customer who redeemed             |
| usedAt             | datetime | ✓        | When challenge was redeemed       |
| challengeIssuedAt  | datetime |          | When challenge was created        |
| challengeExpiresAt | datetime |          | When challenge would have expired |

### Binding Model

The Device record itself serves as the binding between entitlement and device:

- `device.entitlement` points to the bound entitlement
- `device.status = "active"` indicates an active binding
- `device.boundAt` records when binding was created
- `device.lastSeenAt` records last refresh/heartbeat

### API Endpoints

#### POST /api/device/register

Register a device for the authenticated customer.

**Request:**

```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBg...",
  "deviceName": "Work MacBook",
  "platform": "macos"
}
```

**Response (success):**

```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "active",
  "message": "Device registered"
}
```

**Errors:**

- 400: Invalid deviceId or publicKey
- 409: Device is registered to another account

#### POST /api/licence/activate

Activate an entitlement on a registered device.

**Request:**

```json
{
  "entitlementId": 123,
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (success):**

```json
{
  "ok": true,
  "message": "Device activated",
  "entitlement": {
    "id": 123,
    "tier": "pro",
    "status": "active",
    "isLifetime": false,
    "expiresAt": null,
    "currentPeriodEnd": "2026-02-19T00:00:00.000Z",
    "maxDevices": 1
  },
  "device": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "boundAt": "2026-01-20T10:00:00.000Z"
  }
}
```

**Errors:**

- 400: Missing entitlementId or deviceId
- 403: Not owner / entitlement not active / device blocked
- 404: Entitlement or device not found
- 409: Maximum devices limit reached

#### POST /api/licence/refresh

Refresh/heartbeat to confirm device is still active.

**Request:**

```json
{
  "entitlementId": 123,
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "nonce": "abc123",
  "signature": "..."
}
```

**Response (success):**

```json
{
  "ok": true,
  "status": "active",
  "isLifetime": false,
  "expiresAt": null,
  "currentPeriodEnd": "2026-02-19T00:00:00.000Z"
}
```

**Note:** Stage 4 ignores nonce/signature. Stage 5 will add lease token verification.

**Errors:**

- 400: Missing fields
- 403: Device not bound / not active / entitlement expired
- 404: Device or entitlement not found

#### POST /api/licence/deactivate

Deactivate a device from an entitlement.

**Request:**

```json
{
  "entitlementId": 123,
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "deactivationCode": "optional-code"
}
```

**Response (success):**

```json
{
  "ok": true,
  "message": "Device deactivated"
}
```

**Note:** Stage 4 accepts deactivationCode but doesn't verify it. Stage 5 will add offline proof verification.

**Errors:**

- 400: Missing fields / device not bound to this entitlement
- 403: Device not owned
- 404: Device not found

### Audit Events

All endpoints emit structured audit logs:

| Event             | Outcome | Reason Codes                                                                        |
| ----------------- | ------- | ----------------------------------------------------------------------------------- |
| device_register   | success | device_created, device_updated                                                      |
| device_register   | failure | invalid_device_id, invalid_public_key, device_owned_by_another                      |
| device_activate   | success | activated, already_bound                                                            |
| device_activate   | failure | missing\_\*, not_found, not_owner, not_active, max_devices_exceeded, device_blocked |
| device_refresh    | success | refreshed                                                                           |
| device_refresh    | failure | missing_fields, not_found, not_bound, not_active, not_valid                         |
| device_deactivate | success | deactivated                                                                         |
| device_deactivate | failure | missing_fields, not_found, not_owned, not_bound                                     |

### Stage 4 Verification Checklist

This checklist verifies that the Stage 4 device-based activation API is working correctly.

**Prerequisites:**

1. Backend running at `http://localhost:1337`
2. A customer account with at least one active entitlement (Maker or Pro tier, maxDevices=1)
3. Customer JWT token stored in `$TOKEN`

#### Step 0: Login and Get Token

```bash
# Login to get customer token
TOKEN=$(curl -s -X POST http://localhost:1337/api/customers/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"yourpassword"}' | jq -r '.token')

# Verify token and get entitlements
curl -s http://localhost:1337/api/customers/entitlements \
  -H "Authorization: Bearer $TOKEN" | jq '.entitlements[] | {id, tier, maxDevices, status}'
# Note the entitlement ID for subsequent tests
```

#### Verification Steps

| #   | Action                                    | Command                                                                                         | Expected HTTP | Expected Response                                                             |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------- |
| 1   | Register device A                         | `curl -X POST .../api/device/register -d '{"deviceId":"device-a-123","publicKey":"pk-aaa..."}'` | **200**       | `{"deviceId":"device-a-123","status":"active","message":"Device registered"}` |
| 2   | Activate entitlement on device A          | `curl -X POST .../api/licence/activate -d '{"entitlementId":1,"deviceId":"device-a-123"}'`      | **200**       | `{"ok":true,"message":"Device activated",...}`                                |
| 3   | Register device B                         | `curl -X POST .../api/device/register -d '{"deviceId":"device-b-456","publicKey":"pk-bbb..."}'` | **200**       | `{"deviceId":"device-b-456","status":"active","message":"Device registered"}` |
| 4   | Activate same entitlement on device B     | `curl -X POST .../api/licence/activate -d '{"entitlementId":1,"deviceId":"device-b-456"}'`      | **409**       | `{"error":"Maximum devices limit reached"}`                                   |
| 5   | Refresh on device A                       | `curl -X POST .../api/licence/refresh -d '{"entitlementId":1,"deviceId":"device-a-123"}'`       | **200**       | `{"ok":true,"status":"active",...}`                                           |
| 6   | Deactivate device A                       | `curl -X POST .../api/licence/deactivate -d '{"entitlementId":1,"deviceId":"device-a-123"}'`    | **200**       | `{"ok":true,"message":"Device deactivated"}`                                  |
| 7   | Activate on device B (should now succeed) | `curl -X POST .../api/licence/activate -d '{"entitlementId":1,"deviceId":"device-b-456"}'`      | **200**       | `{"ok":true,"message":"Device activated",...}`                                |

#### Full Test Script

```bash
# Setup
BASE_URL="http://localhost:1337"
ENTITLEMENT_ID=1  # Replace with actual entitlement ID from step 0

echo "=== Step 1: Register device A ==="
curl -s -X POST "$BASE_URL/api/device/register" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"device-a-123","publicKey":"pk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}' | jq .
# Expected: 200, {"deviceId":"device-a-123","status":"active","message":"Device registered"}

echo "=== Step 2: Activate entitlement on device A ==="
curl -s -X POST "$BASE_URL/api/licence/activate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"entitlementId\":$ENTITLEMENT_ID,\"deviceId\":\"device-a-123\"}" | jq .
# Expected: 200, {"ok":true,"message":"Device activated",...}

echo "=== Step 3: Register device B ==="
curl -s -X POST "$BASE_URL/api/device/register" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"device-b-456","publicKey":"pk-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}' | jq .
# Expected: 200, {"deviceId":"device-b-456","status":"active","message":"Device registered"}

echo "=== Step 4: Try activate same entitlement on device B (should fail) ==="
curl -s -w "\nHTTP Status: %{http_code}\n" -X POST "$BASE_URL/api/licence/activate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"entitlementId\":$ENTITLEMENT_ID,\"deviceId\":\"device-b-456\"}" | jq .
# Expected: 409, {"error":"Maximum devices limit reached"}

echo "=== Step 5: Refresh on device A ==="
curl -s -X POST "$BASE_URL/api/licence/refresh" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"entitlementId\":$ENTITLEMENT_ID,\"deviceId\":\"device-a-123\"}" | jq .
# Expected: 200, {"ok":true,"status":"active",...}

echo "=== Step 6: Deactivate device A ==="
curl -s -X POST "$BASE_URL/api/licence/deactivate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"entitlementId\":$ENTITLEMENT_ID,\"deviceId\":\"device-a-123\"}" | jq .
# Expected: 200, {"ok":true,"message":"Device deactivated"}

echo "=== Step 7: Activate on device B (should now succeed) ==="
curl -s -X POST "$BASE_URL/api/licence/activate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"entitlementId\":$ENTITLEMENT_ID,\"deviceId\":\"device-b-456\"}" | jq .
# Expected: 200, {"ok":true,"message":"Device activated",...}

echo "=== All tests completed ==="
```

---

## Future Stage References

### Stage 6: Cryptographic Verification (Planned)

Stage 6 will add:

- **Device signature verification**: Device must sign requests with its private key over a nonce
- **Offline deactivation code verification**: Deactivate verifies cryptographic proof for offline scenarios
- **Challenge-response nonce enforcement**: Currently logged but not enforced

### Stage 7: Desktop App Integration (Planned)

Stage 7 will integrate the desktop app with the Stage 4/5 API:

- Desktop app calls `/api/device/register` on first launch
- Desktop app calls `/api/licence/activate` when user enters license
- Desktop app calls `/api/licence/refresh` periodically (heartbeat)
- Desktop app stores and validates lease tokens locally
- Desktop app calls `/api/licence/deactivate` on uninstall/transfer
