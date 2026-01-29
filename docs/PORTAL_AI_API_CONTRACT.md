# Portal AI API Contract (Stage 1–3)

## Overview

The Portal exposes AI endpoints for the LightLane desktop app.
All AI calls require an **AI token** minted by the portal.

Design goals:

- Stable, boring API.
- Minimal payloads.
- Explicit, user-triggered uploads.
- Consistent error envelopes.

## Base URL + versioning

- Base: `/api/v1/ai`
- Versioning is path-based. Any breaking change increments `/v2`.

## Auth model

### Step 1: Customer auth (existing portal auth)

The desktop app authenticates to the portal using existing customer auth (whatever the portal already uses).

### Step 2: Mint AI token

The app calls:

`POST /api/v1/ai/token`

Headers:

```
Authorization: Bearer <customer_jwt>
```

Returns a short-lived token used only for AI endpoints.

#### Response (example)

```json
{
  "ok": true,
  "data": {
    "token": "ai_token_here",
    "expiresAt": "2026-01-29T12:34:56Z"
  }
}
```

### Step 3: Use AI token for AI endpoints

All subsequent AI endpoints require:

```
Authorization: Bearer <ai_token>
```

---

## Stage 1 — Settings Assistant

### Endpoint

`POST /api/v1/ai/settings-assistant`

### Auth

Requires AI token (`Authorization: Bearer <ai_token>`)

### Purpose

Desktop app sends a user prompt (question about LightLane settings/features) and receives AI-generated guidance.

### Request body

```json
{
  "prompt": "How do I enable dark mode?",
  "context": {
    "currentSettings": {
      "theme": "light",
      "language": "en"
    }
  }
}
```

| Field                     | Type   | Required | Constraints                                             |
| ------------------------- | ------ | -------- | ------------------------------------------------------- |
| `prompt`                  | string | yes      | 1-2000 chars                                            |
| `context`                 | object | no       | optional app context                                    |
| `context.currentSettings` | object | no       | key-value pairs, max 10 keys, values max 200 chars each |

### Response (success)

```json
{
  "ok": true,
  "data": {
    "response": "To enable dark mode in LightLane, go to Settings > Appearance and toggle the Theme option to Dark.",
    "model": "gpt-4o-mini"
  }
}
```

### Error responses

All errors follow the standard envelope:

```json
{
  "ok": false,
  "code": "ERROR_CODE",
  "message": "Human-readable message",
  "details": {}
}
```

### Error codes (Settings Assistant)

| Status | Code                     | When                                             |
| ------ | ------------------------ | ------------------------------------------------ |
| 400    | `VALIDATION_ERROR`       | Missing/invalid `prompt`, payload too large      |
| 401    | `UNAUTHENTICATED`        | Missing or invalid AI token                      |
| 403    | `FORBIDDEN`              | Token valid but customer/entitlement deactivated |
| 403    | `ENTITLEMENT_NOT_FOUND`  | Entitlement linked to token no longer exists     |
| 403    | `ENTITLEMENT_NOT_ACTIVE` | Entitlement linked to token is no longer active  |
| 429    | `RATE_LIMITED`           | Too many requests                                |
| 429    | `PROVIDER_RATE_LIMITED`  | OpenAI rate limit exceeded                       |
| 500    | `INTERNAL_ERROR`         | Server misconfiguration (e.g., missing API key)  |
| 502    | `PROVIDER_ERROR`         | OpenAI returned unexpected error                 |
| 504    | `PROVIDER_TIMEOUT`       | OpenAI request timed out                         |

---

## Stage 2 — Background Removal (planned, NOT IMPLEMENTED)

**Status:** No route/handler exists yet. This stage is planned only.

### Intended endpoint (placeholder)

`POST /api/v1/ai/background-removal`

### Intended behavior (placeholder)

- Accepts a single raster image.
- Returns a background-removed result (likely signed URL).
- Will enforce entitlement, size limits, and portal error envelopes.

---

## Stage 3 — Engrave Assistant (Image-based)

### Endpoint

`POST /api/v1/ai/engrave-assistant`

### Auth

Requires AI token (`Authorization: Bearer <ai_token>`)

### Purpose

Desktop app sends a design image plus a goal and device/material context. The portal sends the image to OpenAI and returns a structured settings patch proposal (no automatic apply).

**Important:** The image is uploaded and sent to OpenAI for processing.

### Content type

`multipart/form-data`

Fields:

- `image` (file, required): PNG, JPEG, WEBP, GIF (first frame only), or SVG (rasterized)
- `payload` (string, required): JSON string with prompt/context/availableSettings

**Image handling:** If `image` exceeds `AI_ENGRAVE_MAX_IMAGE_BYTES` (default 5MB), the portal will automatically normalize and downscale/recompress it before sending to OpenAI. Images above `AI_ENGRAVE_ABS_MAX_IMAGE_BYTES` (default 40MB) are rejected. Normalization respects `AI_ENGRAVE_MAX_IMAGE_DIM_PX` (default 2048). SVGs are rejected if they contain scripts, event handlers, foreignObject, or external hrefs; export to PNG if blocked. SVG size is capped at `AI_ENGRAVE_SVG_MAX_BYTES` (default 2MB) and embedded SVG data URIs are capped by `AI_ENGRAVE_SVG_DATA_URI_MAX_BYTES` (default 200KB).

### Payload JSON (string)

```json
{
  "prompt": "Make the engraving crisp with clean edges.",
  "context": {
    "material": "birch plywood",
    "device": "LightLane Pro",
    "currentSettings": { "power": 45, "speed": 220 }
  },
  "availableSettings": {
    "power": { "type": "number", "minimum": 0, "maximum": 100 },
    "speed": { "type": "number", "minimum": 1, "maximum": 300 },
    "passes": { "type": "integer", "minimum": 1, "maximum": 10 },
    "dither": { "type": "boolean" },
    "mode": { "type": "string", "enum": ["raster", "vector"] }
  }
}
```

### `availableSettings` schema

`availableSettings` is an object where each key is a setting name and each value describes constraints:

| Field         | Type      | Required | Notes                                           |
| ------------- | --------- | -------- | ----------------------------------------------- |
| `type`        | `string`  | yes      | one of `string`, `number`, `integer`, `boolean` |
| `enum`        | `array`   | no       | allowed values for the setting                  |
| `minimum`     | `number`  | no       | numeric minimum (number/integer)                |
| `maximum`     | `number`  | no       | numeric maximum (number/integer)                |
| `minLength`   | `integer` | no       | string min length (string)                      |
| `maxLength`   | `integer` | no       | string max length (string)                      |
| `description` | `string`  | no       | human description for the setting               |
| `unit`        | `string`  | no       | unit label (e.g., "mm/s")                       |

### Response (success)

```json
{
  "ok": true,
  "data": {
    "proposedPatch": {
      "power": 55,
      "speed": 180,
      "passes": 1,
      "dither": true,
      "mode": "raster"
    },
    "warnings": ["Test on scrap material first."],
    "questions": [],
    "explanations": ["Balanced power and speed for cleaner edges."],
    "model": "gpt-4o-mini"
  }
}
```

### Error codes (Engrave Assistant)

Same as Settings Assistant, plus validation errors for image/payload:

| Status | Code                     | When                                             |
| ------ | ------------------------ | ------------------------------------------------ |
| 400    | `VALIDATION_ERROR`       | Missing/invalid image or payload fields          |
| 401    | `UNAUTHENTICATED`        | Missing or invalid AI token                      |
| 403    | `FORBIDDEN`              | Token valid but customer/entitlement deactivated |
| 403    | `ENTITLEMENT_NOT_FOUND`  | Entitlement linked to token no longer exists     |
| 403    | `ENTITLEMENT_NOT_ACTIVE` | Entitlement linked to token is no longer active  |
| 429    | `RATE_LIMITED`           | Too many requests                                |
| 429    | `PROVIDER_RATE_LIMITED`  | OpenAI rate limit exceeded                       |
| 500    | `INTERNAL_ERROR`         | Server misconfiguration (e.g., missing API key)  |
| 502    | `PROVIDER_ERROR`         | OpenAI returned unexpected error                 |
| 504    | `PROVIDER_TIMEOUT`       | OpenAI request timed out                         |

---

## App flow and checkbox behavior

- The desktop app uses the same chat UI for both assistants.
- An optional “include image” checkbox adds the image + `availableSettings` payload.
- The portal returns a proposed patch + guidance; the app applies changes only after user confirmation.

---

## Environment variables (AI)

| Variable                               | Default       | Description                             |
| -------------------------------------- | ------------- | --------------------------------------- |
| `OPENAI_API_KEY`                       | (required)    | OpenAI API key (server-side only)       |
| `AI_TOKEN_TTL_SECONDS`                 | `900`         | AI token validity (15 minutes)          |
| `AI_OPENAI_TIMEOUT_MS`                 | `15000`       | OpenAI request timeout                  |
| `AI_OPENAI_MODEL`                      | `gpt-4o-mini` | OpenAI model to use                     |
| `AI_SETTINGS_MAX_PROMPT_CHARS`         | `2000`        | Max prompt length                       |
| `AI_SETTINGS_MAX_CONTEXT_KEYS`         | `10`          | Max keys in context.currentSettings     |
| `AI_SETTINGS_MAX_CONTEXT_VALUE_CHARS`  | `200`         | Max chars per context value             |
| `AI_ENGRAVE_MAX_PROMPT_CHARS`          | `2000`        | Max prompt length for engrave assistant |
| `AI_ENGRAVE_MAX_CONTEXT_CHARS`         | `4000`        | Max context JSON size (chars)           |
| `AI_ENGRAVE_MAX_SETTINGS_KEYS`         | `50`          | Max keys in availableSettings           |
| `AI_ENGRAVE_MAX_SETTINGS_SCHEMA_CHARS` | `10000`       | Max availableSettings size (chars)      |
| `AI_ENGRAVE_MAX_IMAGE_BYTES`           | `5242880`     | Max image size in bytes (5MB)           |

---

## Rate limiting

| Endpoint                             | Limit                             | Key       |
| ------------------------------------ | --------------------------------- | --------- |
| `POST /api/v1/ai/token`              | 10/min per IP                     | `license` |
| `POST /api/v1/ai/settings-assistant` | 10/min per customer ID (AI token) | `ai`      |
| `POST /api/v1/ai/engrave-assistant`  | 10/min per customer ID (AI token) | `ai`      |

---

## Privacy guarantees

1. Prompts and settings content are **never logged** in plaintext
2. Only metadata is logged: customerId, entitlementId, jti (truncated), latency, outcome
3. OpenAI API key is **server-side only**
4. All AI calls are **user-triggered** (no background sending)
