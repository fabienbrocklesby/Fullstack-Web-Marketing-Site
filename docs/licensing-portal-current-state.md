# LightLane Licensing System – Current State Contract

**Document Version:** 2.0  
**Date:** 2026-01-22  
**Scope:** Backend licensing API + portal integration; not desktop app implementation details.

---

## 1. Overview

### What This System Does

LightLane uses a **subscription + lease token** licensing model:

- **Entitlements** represent a customer's right to use the software (subscription or lifetime).
- **Devices** are registered and bound to entitlements.
- **Lease tokens** (RS256 JWTs, 7-day TTL) prove the device has an active subscription.
- **Lifetime entitlements** do not require lease tokens; they are valid forever. However, lifetime entitlements only work with **online verification** — the desktop app must reach the API to confirm activation status. Offline endpoints (challenge-based and air-gapped) reject lifetime entitlements with `LIFETIME_NOT_SUPPORTED`.

### What "Offline" Means

1. **Offline refresh (challenge-based):** The desktop device can be briefly offline, but the customer must access the web portal from another computer to generate and redeem a challenge for a new lease token. The portal generates a short-lived challenge JWT, which the customer then submits back to the portal (from the same or different browser session) to receive a lease token. This flow does NOT require a cryptographic response from the app — the challenge JWT itself is redeemed.

2. **Air-gapped (Stage 6.1):** For fully disconnected environments, the desktop app generates cryptographic codes (USB/copy-paste). These codes are Ed25519-signed by the device. The portal verifies the signatures and returns activation packages or lease tokens as downloadable codes.

### Non-Goals (Explicitly Not Supported)

- **Offline lifetime:** Lifetime/founders licenses are online-only. Offline provisioning and lease refresh endpoints reject lifetime entitlements with `LIFETIME_NOT_SUPPORTED`.

---

## 2. Data Model (Concepts)

### Entitlement

| Field              | Type                                      | Description                                   |
| ------------------ | ----------------------------------------- | --------------------------------------------- |
| `id`               | integer                                   | Primary key                                   |
| `customer`         | relation                                  | Owning customer                               |
| `tier`             | enum: maker, pro, education, enterprise   | Product tier                                  |
| `status`           | enum: active, inactive, expired, canceled | Subscription status                           |
| `isLifetime`       | boolean                                   | `true` = founders/lifetime, no lease required |
| `maxDevices`       | integer (≥1)                              | Maximum simultaneously bound devices          |
| `expiresAt`        | datetime                                  | Subscription expiry (null for lifetime)       |
| `currentPeriodEnd` | datetime                                  | Stripe billing period end                     |

### Device

| Field           | Type                                        | Description                            |
| --------------- | ------------------------------------------- | -------------------------------------- |
| `id`            | integer                                     | Primary key                            |
| `deviceId`      | string (unique)                             | Device identifier (app-generated UUID) |
| `publicKey`     | text                                        | Ed25519 SPKI DER, base64 encoded       |
| `publicKeyHash` | string                                      | SHA256 hex hash of publicKey           |
| `customer`      | relation                                    | Owning customer                        |
| `entitlement`   | relation                                    | Bound entitlement (null if unbound)    |
| `status`        | enum: active, blocked, revoked, deactivated | Device state                           |
| `boundAt`       | datetime                                    | When bound to entitlement              |
| `lastSeenAt`    | datetime                                    | Last refresh/heartbeat                 |
| `deviceName`    | string                                      | Human-readable name                    |
| `platform`      | enum: windows, macos, linux, unknown        | OS platform                            |

### Replay Protection (Strapi Collection Types)

**`api::offline-challenge.offline-challenge`** (collection: `offline_challenges`) — Challenge-based offline refresh:

| Field                | Type     | Description                     |
| -------------------- | -------- | ------------------------------- |
| `jti`                | string   | Challenge nonce (unique)        |
| `entitlementId`      | integer  | Associated entitlement          |
| `deviceId`           | string   | Associated device               |
| `customerId`         | integer  | Customer who used the challenge |
| `usedAt`             | datetime | When the challenge was redeemed |
| `challengeIssuedAt`  | datetime | When challenge JWT was issued   |
| `challengeExpiresAt` | datetime | When challenge JWT expires      |

**`api::offline-code-use.offline-code-use`** (collection: `offline_code_uses`) — Air-gapped code replay:

| Field           | Type                                           | Description                 |
| --------------- | ---------------------------------------------- | --------------------------- |
| `jti`           | string (unique)                                | Code's unique identifier    |
| `kind`          | enum: LEASE_REFRESH_REQUEST, DEACTIVATION_CODE | Code type                   |
| `customerId`    | integer                                        | Customer who submitted      |
| `entitlementId` | integer                                        | Associated entitlement      |
| `deviceId`      | string                                         | Associated device           |
| `usedAt`        | datetime                                       | When the code was processed |
| `expiresAt`     | datetime                                       | Optional expiry (cleanup)   |

**Note:** Activation packages are NOT tracked in replay tables. Their "single-use" guarantee comes from device binding + token expiry (72h), not server-side replay rejection.

### Cryptographic Primitives

| What                | Algorithm          | Key Source                |
| ------------------- | ------------------ | ------------------------- |
| Lease token signing | RS256 (RSA-SHA256) | `JWT_PRIVATE_KEY` env var |
| Lease token verify  | RS256              | `JWT_PUBLIC_KEY` env var  |
| Device signatures   | Ed25519            | Device-generated keypair  |
| Public key hash     | SHA256             | Hash of SPKI DER bytes    |

---

## 3. Online Flow

All online endpoints require `customer-auth` middleware (portal JWT in Authorization header).

### 3.1 Register Device

**Endpoint:** `POST /api/device/register`  
**Middleware:** `customer-auth`, `license-rate-limit`

**Request:**

```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "publicKey": "<base64 Ed25519 SPKI DER>",
  "deviceName": "My Workstation",
  "platform": "windows"
}
```

| Field        | Required | Description                         |
| ------------ | -------- | ----------------------------------- |
| `deviceId`   | Yes      | Unique device identifier (≥3 chars) |
| `publicKey`  | No       | Ed25519 public key (for air-gapped) |
| `deviceName` | No       | Human-readable name                 |
| `platform`   | No       | windows, macos, linux, unknown      |

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "deviceId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "active",
    "message": "Device registered"
  }
}
```

**Errors:**
| Status | Code | Description |
| ------ | ----------------- | ------------------------------------------ |
| 400 | VALIDATION_ERROR | Missing/invalid deviceId |
| 401 | UNAUTHENTICATED | No valid customer auth |
| 409 | DEVICE_NOT_OWNED | Device registered to another account |

---

### 3.2 Activate Entitlement

**Endpoint:** `POST /api/licence/activate`  
**Middleware:** `customer-auth`, `license-rate-limit`

**Request:**

```json
{
  "entitlementId": 123,
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "message": "Device activated",
    "entitlement": {
      "id": 123,
      "tier": "pro",
      "status": "active",
      "isLifetime": false,
      "expiresAt": "2026-12-31T23:59:59.000Z",
      "currentPeriodEnd": "2026-02-22T00:00:00.000Z",
      "maxDevices": 2
    },
    "device": {
      "deviceId": "550e8400-e29b-41d4-a716-446655440000",
      "boundAt": "2026-01-22T12:00:00.000Z"
    }
  }
}
```

**Errors:**
| Status | Code | Description |
| ------ | ---------------------- | ---------------------------------------- |
| 400 | VALIDATION_ERROR | Missing entitlementId or deviceId |
| 401 | UNAUTHENTICATED | No valid customer auth |
| 403 | FORBIDDEN | Not owner or device blocked |
| 403 | ENTITLEMENT_NOT_ACTIVE | Subscription not active |
| 403 | DEVICE_NOT_OWNED | Device belongs to another customer |
| 404 | ENTITLEMENT_NOT_FOUND | Entitlement doesn't exist |
| 404 | DEVICE_NOT_FOUND | Device not registered |
| 409 | MAX_DEVICES_EXCEEDED | Would exceed maxDevices limit |

**Side Effects:**

- Creates binding: device.entitlement → entitlement
- Sets device.status = "active", device.boundAt = now
- Idempotent: if already bound to same entitlement, returns success

---

### 3.3 Refresh Lease (Online)

**Endpoint:** `POST /api/licence/refresh`  
**Middleware:** `customer-auth`, `license-rate-limit`

**Request:**

```json
{
  "entitlementId": 123,
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200) — Subscription:**

```json
{
  "ok": true,
  "data": {
    "status": "active",
    "isLifetime": false,
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "currentPeriodEnd": "2026-02-22T00:00:00.000Z",
    "serverTime": "2026-01-22T12:00:00.000Z",
    "leaseRequired": true,
    "leaseToken": "<RS256 JWT>",
    "leaseExpiresAt": "2026-01-29T12:00:00.000Z"
  }
}
```

**Response (200) — Lifetime:**

```json
{
  "ok": true,
  "data": {
    "status": "active",
    "isLifetime": true,
    "expiresAt": null,
    "currentPeriodEnd": null,
    "serverTime": "2026-01-22T12:00:00.000Z",
    "leaseRequired": false,
    "leaseToken": null,
    "leaseExpiresAt": null
  }
}
```

**Errors:**
| Status | Code | Description |
| ------ | ---------------------- | -------------------------------- |
| 400 | VALIDATION_ERROR | Missing required fields |
| 401 | UNAUTHENTICATED | No valid customer auth |
| 403 | DEVICE_NOT_BOUND | Device not activated for this entitlement |
| 403 | DEVICE_NOT_OWNED | Device belongs to another customer |
| 403 | ENTITLEMENT_NOT_ACTIVE | Subscription expired/canceled |
| 404 | DEVICE_NOT_FOUND | Device doesn't exist |
| 404 | ENTITLEMENT_NOT_FOUND | Entitlement doesn't exist |

**Lease Token Claims (RS256 JWT):**

```json
{
  "iss": "lightlane",
  "sub": "ent:123:dev:550e8400-...",
  "jti": "<uuid>",
  "iat": 1737547200,
  "exp": 1738152000,
  "purpose": "lease",
  "entitlementId": 123,
  "customerId": 456,
  "deviceId": "550e8400-...",
  "tier": "pro",
  "isLifetime": false
}
```

---

### 3.4 Deactivate (Online)

**Endpoint:** `POST /api/licence/deactivate`  
**Middleware:** `customer-auth`, `license-rate-limit`

**Request:**

```json
{
  "entitlementId": 123,
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "message": "Device deactivated"
  }
}
```

**Errors:**
| Status | Code | Description |
| ------ | ----------------- | -------------------------------- |
| 400 | VALIDATION_ERROR | Missing required fields |
| 400 | DEVICE_NOT_BOUND | Device not bound to entitlement |
| 401 | UNAUTHENTICATED | No valid customer auth |
| 403 | DEVICE_NOT_OWNED | Device belongs to another customer |
| 404 | DEVICE_NOT_FOUND | Device doesn't exist |

**Side Effects:**

- Clears device.entitlement (unbinds)
- Sets device.status = "deactivated", device.deactivatedAt = now

---

## 4. Offline Challenge/Response Flow

For subscription entitlements when the desktop device cannot reach the API directly. The customer uses the portal to:

1. Generate a challenge JWT (encodes entitlementId, deviceId, nonce)
2. Redeem that same challenge JWT to receive a lease token

This is a **portal-to-portal** flow — the challenge JWT is issued by the server and redeemed by the same customer through the portal UI. No cryptographic response from the desktop app is required (unlike the air-gapped flow which uses Ed25519 signatures).

### 4.1 Generate Offline Challenge

**Endpoint:** `POST /api/licence/offline-challenge`  
**Middleware:** `customer-auth`, `license-rate-limit`

**Request:**

```json
{
  "entitlementId": 123,
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "challengeToken": "<RS256 JWT>",
    "challengeExpiresAt": "2026-01-22T12:10:00.000Z",
    "serverTime": "2026-01-22T12:00:00.000Z",
    "entitlement": {
      "id": 123,
      "tier": "pro",
      "isLifetime": false
    }
  }
}
```

**Errors:**
| Status | Code | Description |
| ------ | ----------------------- | ---------------------------------------- |
| 400 | VALIDATION_ERROR | Missing required fields |
| 400 | LIFETIME_NOT_SUPPORTED | Offline refresh not available for lifetime |
| 401 | UNAUTHENTICATED | No valid customer auth |
| 403 | FORBIDDEN | Not owner of entitlement |
| 403 | ENTITLEMENT_NOT_ACTIVE | Subscription not active |
| 403 | DEVICE_NOT_OWNED | Device belongs to another customer |
| 404 | ENTITLEMENT_NOT_FOUND | Entitlement doesn't exist |
| 404 | DEVICE_NOT_FOUND | Device doesn't exist |

**Challenge Token Claims (RS256 JWT, 10-minute TTL):**

```json
{
  "iss": "lightlane",
  "sub": "challenge:123:550e8400-...",
  "jti": "<uuid>",
  "iat": 1737547200,
  "exp": 1737547800,
  "purpose": "offline_challenge",
  "entitlementId": 123,
  "customerId": 456,
  "deviceId": "550e8400-...",
  "nonce": "<uuid>"
}
```

---

### 4.2 Redeem Offline Challenge

**Endpoint:** `POST /api/licence/offline-refresh`  
**Middleware:** `customer-auth`, `license-rate-limit`

**Request:**

```json
{
  "challenge": "<RS256 JWT challenge token>"
}
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "leaseRequired": true,
    "leaseToken": "<RS256 JWT>",
    "leaseExpiresAt": "2026-01-29T12:00:00.000Z",
    "serverTime": "2026-01-22T12:00:00.000Z"
  }
}
```

**Errors:**
| Status | Code | Description |
| ------ | ---------------------- | ------------------------------------ |
| 400 | VALIDATION_ERROR | Missing challenge field |
| 400 | CHALLENGE_EXPIRED | Challenge JWT expired |
| 400 | CHALLENGE_INVALID | Challenge JWT invalid |
| 400 | LIFETIME_NOT_SUPPORTED | Entitlement is lifetime |
| 401 | UNAUTHENTICATED | No valid customer auth |
| 403 | FORBIDDEN | Not owner of entitlement |
| 403 | DEVICE_NOT_OWNED | Device belongs to another customer |
| 403 | ENTITLEMENT_NOT_ACTIVE | Subscription not active |
| 404 | ENTITLEMENT_NOT_FOUND | Entitlement doesn't exist |
| 404 | DEVICE_NOT_FOUND | Device doesn't exist |
| 409 | REPLAY_REJECTED | Challenge already used |

**Transfer to Offline Device:**

The lease token returned by the portal must be transferred back to the offline device (copy/paste or file download → USB → import) for the app to use. The app then validates the RS256 signature and extracts the lease expiry.

**Side Effects:**

- Records challenge JTI in `offline_challenges` table for replay protection
- Updates device.lastSeenAt

---

## 5. Air-Gapped Flow (Stage 6.1)

For fully disconnected environments using USB/copy-paste codes. All codes are base64url-encoded JSON objects.

### 5.1 Device Setup Code (App → Portal)

Generated by the desktop app. Does **not** include `entitlementId` — binding happens during provisioning.

**Format:**

```json
{
  "v": 1,
  "type": "device_setup",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "deviceName": "Air-Gapped Workstation",
  "platform": "linux",
  "publicKey": "<base64 Ed25519 SPKI DER>",
  "createdAt": "2026-01-22T12:00:00.000Z"
}
```

| Field        | Required | Constraints                              |
| ------------ | -------- | ---------------------------------------- |
| `v`          | Yes      | Must be `1`                              |
| `type`       | Yes      | Must be `device_setup`                   |
| `deviceId`   | Yes      | 3–256 chars                              |
| `deviceName` | No       | Max 256 chars                            |
| `platform`   | No       | Max 64 chars                             |
| `publicKey`  | Yes      | 32–1024 chars (Ed25519 SPKI DER, base64) |
| `createdAt`  | Yes      | ISO 8601 timestamp                       |

---

### 5.2 Offline Provision

**Endpoint:** `POST /api/licence/offline-provision`  
**Middleware:** `customer-auth`, `license-rate-limit`

**Request:**

```json
{
  "deviceSetupCode": "<base64url-encoded device_setup JSON>",
  "entitlementId": 123
}
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "activationPackage": "<base64url-encoded activation_package JSON>",
    "leaseExpiresAt": "2026-01-29T12:00:00.000Z",
    "serverTime": "2026-01-22T12:00:00.000Z"
  }
}
```

**Activation Package Format:**

```json
{
  "v": 1,
  "type": "activation_package",
  "activationToken": "<RS256 JWT>",
  "leaseToken": "<RS256 JWT>",
  "leaseExpiresAt": "2026-01-29T12:00:00.000Z"
}
```

**Activation Token Claims (RS256 JWT, 72-hour TTL):**

```json
{
  "iss": "lightlane",
  "sub": "offline_activation:123:550e8400-...",
  "jti": "<uuid>",
  "iat": 1737547200,
  "exp": 1737806400,
  "typ": "offline_activation",
  "customerId": 456,
  "entitlementId": 123,
  "deviceId": "550e8400-...",
  "devicePublicKeyHash": "<sha256 hex>"
}
```

**Errors:**
| Status | Code | Description |
| ------ | ---------------------- | ------------------------------------ |
| 400 | VALIDATION_ERROR | Missing required fields |
| 400 | INVALID_SETUP_CODE | Malformed setup code |
| 400 | INVALID_PUBLIC_KEY | Public key not valid Ed25519 |
| 400 | LIFETIME_NOT_SUPPORTED | Offline provision not for lifetime |
| 401 | UNAUTHENTICATED | No valid customer auth |
| 403 | FORBIDDEN | Not owner or device owned by another |
| 403 | ENTITLEMENT_NOT_ACTIVE | Subscription not active |
| 404 | ENTITLEMENT_NOT_FOUND | Entitlement doesn't exist |
| 409 | MAX_DEVICES_EXCEEDED | Would exceed maxDevices |
| 500 | INTERNAL_ERROR | JWT_PRIVATE_KEY not configured |

**Side Effects:**

- Creates or updates device record with publicKey, publicKeyHash
- Binds device to entitlement (enforces maxDevices)
- Idempotent: re-provisioning same device returns new activation package and lease token

**Important:** Activation packages are NOT replay-protected server-side. The server does not track whether an activation package has been "consumed" by the app. Security relies on:

- Device binding (publicKeyHash in token must match device's key)
- Token expiry (72-hour TTL)
- maxDevices enforcement at provision time

---

### 5.3 Lease Refresh Request Code (App → Portal)

Generated by the desktop app, signed with device's Ed25519 private key.

**Format:**

```json
{
  "v": 1,
  "type": "lease_refresh_request",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "entitlementId": 123,
  "jti": "<uuid>",
  "iat": "2026-01-22T12:00:00.000Z",
  "sig": "<base64url Ed25519 signature>"
}
```

**Signature Message Format:**

```
LL|v1|lease_refresh_request
<deviceId>
<entitlementId>
<jti>
<iat>
```

| Field           | Required | Constraints                                |
| --------------- | -------- | ------------------------------------------ |
| `v`             | Yes      | Must be `1`                                |
| `type`          | Yes      | Must be `lease_refresh_request`            |
| `deviceId`      | Yes      | 3–256 chars                                |
| `entitlementId` | Yes      | Integer                                    |
| `jti`           | Yes      | 8–128 chars (unique)                       |
| `iat`           | Yes      | Max 64 chars                               |
| `sig`           | Yes      | 32–512 chars (base64url Ed25519 signature) |

---

### 5.4 Offline Lease Refresh

**Endpoint:** `POST /api/licence/offline-lease-refresh`  
**Middleware:** `customer-auth`, `license-rate-limit`

**Request:**

```json
{
  "requestCode": "<base64url-encoded lease_refresh_request JSON>"
}
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "refreshResponseCode": "<base64url-encoded lease_refresh_response JSON>",
    "leaseExpiresAt": "2026-01-29T12:00:00.000Z",
    "serverTime": "2026-01-22T12:00:00.000Z"
  }
}
```

**Lease Refresh Response Format:**

```json
{
  "v": 1,
  "type": "lease_refresh_response",
  "leaseToken": "<RS256 JWT>",
  "leaseExpiresAt": "2026-01-29T12:00:00.000Z"
}
```

**Errors:**
| Status | Code | Description |
| ------ | ----------------------------- | ------------------------------ |
| 400 | VALIDATION_ERROR | Missing requestCode |
| 400 | INVALID_REQUEST_CODE | Malformed request code |
| 400 | INVALID_PUBLIC_KEY | Device missing public key |
| 400 | DEVICE_NOT_BOUND | Device not bound to entitlement |
| 400 | LIFETIME_NOT_SUPPORTED | Entitlement is lifetime |
| 401 | UNAUTHENTICATED | No valid customer auth |
| 403 | DEVICE_NOT_OWNED | Device belongs to another |
| 403 | SIGNATURE_VERIFICATION_FAILED | Ed25519 signature invalid |
| 403 | ENTITLEMENT_NOT_ACTIVE | Subscription not active |
| 404 | DEVICE_NOT_FOUND | Device doesn't exist |
| 404 | ENTITLEMENT_NOT_FOUND | Entitlement doesn't exist |
| 409 | REPLAY_REJECTED | JTI already used |
| 500 | INTERNAL_ERROR | Public key corrupted |

**Side Effects:**

- Records JTI in `offline_code_uses` (kind: LEASE_REFRESH_REQUEST)
- Updates device.lastSeenAt

---

### 5.5 Deactivation Code (App → Portal)

Generated by the desktop app, signed with device's Ed25519 private key.

**Format:**

```json
{
  "v": 1,
  "type": "deactivation_code",
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "entitlementId": 123,
  "jti": "<uuid>",
  "iat": "2026-01-22T12:00:00.000Z",
  "sig": "<base64url Ed25519 signature>"
}
```

**Signature Message Format:**

```
LL|v1|deactivation_code
<deviceId>
<entitlementId>
<jti>
<iat>
```

---

### 5.6 Offline Deactivate

**Endpoint:** `POST /api/licence/offline-deactivate`  
**Middleware:** `customer-auth`, `license-rate-limit`

**Request:**

```json
{
  "deactivationCode": "<base64url-encoded deactivation_code JSON>"
}
```

**Response (200):**

```json
{
  "ok": true,
  "data": {
    "message": "Device deactivated"
  }
}
```

**Errors:**
| Status | Code | Description |
| ------ | ----------------------------- | ------------------------------ |
| 400 | VALIDATION_ERROR | Missing deactivationCode |
| 400 | INVALID_DEACTIVATION_CODE | Malformed deactivation code |
| 400 | INVALID_PUBLIC_KEY | Device missing public key |
| 400 | DEVICE_NOT_BOUND | Device not bound to entitlement |
| 401 | UNAUTHENTICATED | No valid customer auth |
| 403 | DEVICE_NOT_OWNED | Device belongs to another |
| 403 | SIGNATURE_VERIFICATION_FAILED | Ed25519 signature invalid |
| 404 | DEVICE_NOT_FOUND | Device doesn't exist |
| 409 | REPLAY_REJECTED | JTI already used |
| 500 | INTERNAL_ERROR | Public key corrupted |

**Side Effects:**

- Records JTI in `offline_code_uses` (kind: DEACTIVATION_CODE)
- Clears device.entitlement, sets device.status = "deactivated"

---

## 6. App Integration Notes

### What the Desktop App Must Store

| Item              | Purpose                                              |
| ----------------- | ---------------------------------------------------- |
| `deviceId`        | Unique identifier (UUID, persisted across installs)  |
| Ed25519 keypair   | Signs offline codes; public key registered on server |
| `activationToken` | Proves initial provisioning (air-gapped only)        |
| `leaseToken`      | Current lease JWT (subscription only)                |
| `entitlementId`   | Extracted from lease token claims                    |
| `leaseExpiresAt`  | When to prompt for refresh                           |

### Transfer Methods (Air-Gapped)

The portal supports:

- **Copy/paste:** User copies base64url code from app, pastes into portal form
- **File upload:** Portal accepts `.txt` or `.json` files containing codes
- **Download:** Portal provides activation packages and refresh responses as downloadable files

### What the App Must Verify

1. **Lease token signature:** Verify RS256 signature using server's public key
2. **Device binding:** Check `deviceId` in token matches local device
3. **Expiry:** Check `exp` claim; prompt for refresh before expiry
4. **Activation token (air-gapped):** Verify `devicePublicKeyHash` matches local key

### Recommended Refresh Strategy

- Check lease expiry at app startup
- Warn user 24–48 hours before expiry
- Grace period: app may continue for a short time after expiry (local policy)

---

## 7. Security Guarantees and Limitations

### What Is Prevented

| Threat                      | Mitigation                                                                   |
| --------------------------- | ---------------------------------------------------------------------------- |
| Token tampering             | RS256 signatures (server private key)                                        |
| Challenge replay            | JTI stored in `offline_challenges` on redemption                             |
| Air-gapped code replay      | JTI stored in `offline_code_uses` (LEASE_REFRESH_REQUEST, DEACTIVATION_CODE) |
| Cross-device token use      | `deviceId` binding in token claims                                           |
| Unauthorized air-gapped ops | Ed25519 signature verification (device must prove key possession)            |
| Brute-force                 | Rate limiting on all endpoints                                               |

**Note:** Activation package "replay" is not prevented server-side. The same activation package can be imported multiple times by the same device. Protection comes from device binding + expiry.

### What Cannot Be Prevented (Offline Risk)

| Risk                | Reality                                                                     |
| ------------------- | --------------------------------------------------------------------------- |
| Key theft/cloning   | If Ed25519 private key is extracted, attacker can sign codes                |
| Lease token sharing | Once issued, token works on any machine with matching deviceId until expiry |
| Offline grace abuse | Local enforcement of grace period is app-side policy                        |

### Lease Token Expiry

- **Default TTL:** 7 days (configurable via `LEASE_TOKEN_TTL_SECONDS`)
- **Challenge TTL:** 10 minutes (short-lived for offline challenge flow)
- **Activation token TTL:** 72 hours (configurable via `OFFLINE_ACTIVATION_TTL_SECONDS`)

---

## 8. Environment Variables

| Variable                         | Default        | Description               |
| -------------------------------- | -------------- | ------------------------- |
| `JWT_PRIVATE_KEY`                | (required)     | RS256 private key (PEM)   |
| `JWT_PUBLIC_KEY`                 | (required)     | RS256 public key (PEM)    |
| `JWT_ISSUER`                     | `lightlane`    | JWT issuer claim          |
| `LEASE_TOKEN_TTL_SECONDS`        | `604800` (7d)  | Lease token validity      |
| `OFFLINE_ACTIVATION_TTL_SECONDS` | `259200` (72h) | Activation token validity |

---

## 9. Quick Reference: Endpoint Summary

| Endpoint                             | Method | Auth     | Purpose                                                       |
| ------------------------------------ | ------ | -------- | ------------------------------------------------------------- |
| `/api/device/register`               | POST   | customer | Register device                                               |
| `/api/licence/activate`              | POST   | customer | Bind device to entitlement                                    |
| `/api/licence/refresh`               | POST   | customer | Online lease refresh                                          |
| `/api/licence/deactivate`            | POST   | customer | Unbind device                                                 |
| `/api/licence/offline-challenge`     | POST   | customer | Generate challenge (subscriptions)                            |
| `/api/licence/offline-refresh`       | POST   | customer | Redeem challenge for lease                                    |
| `/api/licence/verify-lease`          | POST   | customer | **Debug/internal:** verify lease token (not used by frontend) |
| `/api/licence/offline-provision`     | POST   | customer | Air-gapped device provisioning                                |
| `/api/licence/offline-lease-refresh` | POST   | customer | Air-gapped lease refresh                                      |
| `/api/licence/offline-deactivate`    | POST   | customer | Air-gapped deactivation                                       |

---

## 10. Changelog

### 2026-01-22: Customer Dashboard UI Polish

**Summary:** Improved spacing, typography, and DaisyUI component consistency across the customer dashboard, with particular focus on the air-gapped activation card.

**Changes:**

- **Air-gapped activation card:**
  - Textareas now full-width with `w-full min-h-32` and responsive text sizing (`text-xs sm:text-sm`)
  - Warning alert uses proper DaisyUI styling with `opacity-80` for secondary text
  - Buttons changed from `btn-accent` to `btn-primary` for consistency
  - Result buttons use `btn-ghost` instead of `btn-outline` for secondary actions
  - Copy/Download buttons laid out in responsive flex column (`flex sm:flex-col`)
  - Tab content has consistent `pt-1` top padding
  - Tabs background uses `bg-base-300/50` for subtle contrast
  - Form labels use `font-medium` for better hierarchy
  - Helper text uses `text-base-content/60` consistently
  - File load helper row uses `flex-wrap items-center gap-2` for clean wrapping

- **Dashboard cards (overview + advanced):**
  - Consistent `p-6` padding and `mb-5` header margins across all cards
  - Device management description has `mt-1` for proper spacing

**Files touched:**

- `frontend/src/pages/customer/dashboard.astro`

**API/Backend impact:** None. This is a styling-only change; no endpoint contracts, flow logic, or schemas were modified.

**Tests/Scripts run:**

- `pnpm build` (frontend) — ✅ Success

```
 frontend/src/pages/customer/dashboard.astro | 787 +++-----
 1 file changed, 312 insertions(+), 475 deletions(-)
```

---

### 2026-01-22: Remove Legacy "Offline Refresh" Card from Customer Dashboard

**Summary:** Removed the legacy challenge-based "Offline Refresh" card from the Advanced tab. The newer "Air-Gapped Device Activation" card (with Provision/Refresh/Deactivate tabs) remains and provides all necessary offline functionality.

**Changes:**

- Removed HTML section `<section id="offline-section">` (~175 lines)
- Removed `renderOfflineSection()` function
- Removed `updateOfflineBtn()` function
- Removed event handlers for `offline-redeem-btn`, `copy-lease-btn`, `offline-reset-btn`
- Updated file header comment

**Rationale:** The legacy Offline Refresh flow (challenge → lease token) overlaps with the air-gapped Lease Refresh tab. Removing it reduces user confusion and code maintenance burden. The `/api/licence/offline-refresh` backend endpoint remains available if needed for other integrations.

**Files touched:**

- `frontend/src/pages/customer/dashboard.astro`

**API/Backend impact:** None. Backend endpoints unchanged.

**Tests/Scripts run:**

- `pnpm build` (frontend) — ✅ Success

---

### 2026-01-22: Customer Portal Dashboard Pagination

**Summary:** Added pagination controls and a plans count label to the customer dashboard for improved usability when customers have many plans or devices.

**Changes:**

- Added "Plans (X)" count badge to the plans section header (matching existing "Devices (X)" style)
- Added client-side pagination for the plans list (5 items per page)
- Added client-side pagination for the devices list in Overview tab (3 items per page)
- Added client-side pagination for the devices table in Advanced tab (10 items per page)
- Pagination controls appear only when items exceed page size
- Previous/Next buttons are disabled appropriately on first/last pages
- Total counts reflect all items (not just current page)

**Files touched:**

- `frontend/src/pages/customer/dashboard.astro`

**API/Backend impact:** None. This is a UI-only change; no endpoint contracts or schemas were modified.

**Tests/Scripts run:**

- `pnpm build` (frontend) — ✅ Success
- `node --test tests/offline-codes.test.js` (backend) — ✅ 49/49 tests pass

---

_End of contract document._
