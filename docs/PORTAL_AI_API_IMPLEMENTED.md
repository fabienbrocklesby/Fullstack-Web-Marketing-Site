# Portal AI API (Implemented Behavior)

## Overview

This document describes the **currently implemented** Portal AI API behavior in the backend. It is intended to be a precise reflection of the code, not a roadmap.

Stage naming is documentation-only; endpoints remain callable regardless of stage labels.

**Implemented endpoints:**

- `POST /api/v1/ai/token`
- `POST /api/v1/ai/settings-assistant`
- `POST /api/v1/ai/engrave-assistant`

**Not implemented in code:**

- Background removal is **not implemented** (no route/handler exists).

## Security & privacy notes

- All AI endpoints return the portal envelope via `sendOk` / `sendError`.
- Prompts, images, and tokens are **never logged** in plaintext.
- Image uploads for `engrave-assistant` are explicitly sent to OpenAI.
- Only coarse metadata is audited (e.g., image size/type, latency, counts).

## Auth model

1. **Customer JWT** (portal auth) is used **only** to mint an AI token.
2. **AI token** (short-lived) is used for AI endpoints.

### AI token details

- Token type: `ai`
- TTL: `AI_TOKEN_TTL_SECONDS` (default 900 seconds)
- Minting requires an active entitlement.

## Endpoints

### 1) `POST /api/v1/ai/token`

**Purpose:** Mint a short-lived AI token for the desktop app.

**Auth:** Customer JWT (`Authorization: Bearer <customer_jwt>`).

**Content-Type:** `application/json`

**Request body:** none (empty JSON is acceptable).

**Response (success):**

```json
{
  "ok": true,
  "data": {
    "token": "<ai_token>",
    "expiresAt": "2026-01-29T12:34:56Z"
  }
}
```

**Error envelope (all endpoints):**

```json
{
  "ok": false,
  "code": "ERROR_CODE",
  "message": "Human-readable message",
  "details": {}
}
```

`details` is optional and only included when relevant (e.g., validation errors).

**Error codes (from implementation):**

- 401 `UNAUTHENTICATED` (missing/invalid customer context)
- 403 `ENTITLEMENT_NOT_ACTIVE`
- 500 `INTERNAL_ERROR`

**Rate limit middleware:** `global::license-rate-limit` (per IP)

---

### 2) `POST /api/v1/ai/settings-assistant`

**Purpose:** Text-only assistant for LightLane settings questions.

**Auth:** AI token (`Authorization: Bearer <ai_token>`)

**Content-Type:** `application/json`

**Request body (minimal):**

```json
{
  "prompt": "How do I enable dark mode?"
}
```

**Optional context:**

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

**Validation constraints (code-derived):**

- `prompt` is required and must be a non-empty string.
- `prompt` max length: `AI_SETTINGS_MAX_PROMPT_CHARS` (default 2000).
- `context` is optional but must be an object if provided.
- `context.currentSettings` is optional but must be an object if provided.
- `context.currentSettings` max keys: `AI_SETTINGS_MAX_CONTEXT_KEYS` (default 10).
- Each `context.currentSettings` value is stringified; max length: `AI_SETTINGS_MAX_CONTEXT_VALUE_CHARS` (default 200).

**Response (success):**

```json
{
  "ok": true,
  "data": {
    "response": "To enable dark mode in LightLane, go to Settings > Appearance...",
    "model": "gpt-4o-mini"
  }
}
```

**Error codes (from implementation):**

- 400 `VALIDATION_ERROR`
- 401 `UNAUTHENTICATED`
- 403 `FORBIDDEN`
- 403 `ENTITLEMENT_NOT_FOUND`
- 403 `ENTITLEMENT_NOT_ACTIVE`
- 429 `RATE_LIMITED`
- 429 `PROVIDER_RATE_LIMITED`
- 500 `INTERNAL_ERROR`
- 502 `PROVIDER_ERROR`
- 504 `PROVIDER_TIMEOUT`

**Rate limit middleware:** `global::ai-rate-limit` (per customer ID from AI token; falls back to IP)

---

### 3) `POST /api/v1/ai/engrave-assistant`

**Purpose:** Image-based assistant that proposes **settings patches** based on the uploaded design image and the request-provided `availableSettings` schema. The API **does not apply** settings.

**Auth:** AI token (`Authorization: Bearer <ai_token>`)

**Content-Type:** `multipart/form-data`

**Fields:**

- `image` (file, PNG or JPG, required)
- `payload` (JSON string, required)

**Payload JSON (minimal):**

```json
{
  "prompt": "Make the engraving crisp with clean edges.",
  "context": {
    "material": "birch plywood",
    "device": "LightLane Pro"
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

**Validation constraints (code-derived):**

- `payload` must be a JSON string.
- `payload.prompt` is required and must be a non-empty string.
- `payload.prompt` max length: `AI_ENGRAVE_MAX_PROMPT_CHARS` (default 2000).
- `payload.context` is optional but must be an object if provided.
- `payload.context` max JSON size: `AI_ENGRAVE_MAX_CONTEXT_CHARS` (default 4000).
- `payload.availableSettings` is required and must be an object with at least 1 key.
- `payload.availableSettings` max keys: `AI_ENGRAVE_MAX_SETTINGS_KEYS` (default 50).
- `payload.availableSettings` max JSON size: `AI_ENGRAVE_MAX_SETTINGS_SCHEMA_CHARS` (default 10000).
- `availableSettings.*.type` required and must be one of `string`, `number`, `integer`, `boolean`.
- Allowed fields per setting: `type`, `enum`, `minimum`, `maximum`, `minLength`, `maxLength`, `description`, `unit`.
- `enum` must be a non-empty array (string enums must be strings; number/integer enums must be numbers; integers must be integers).
- `minimum`/`maximum` must be numbers and `minimum <= maximum` when both present.
- `minLength`/`maxLength` must be integers and `minLength <= maxLength` when both present.
- `image` required; allowed types: PNG/JPEG; must be non-empty; max size `AI_ENGRAVE_MAX_IMAGE_BYTES` (default 5MB).

**Response (success):**

```json
{
  "ok": true,
  "data": {
    "proposedPatch": {
      "power": 50,
      "speed": 150,
      "passes": 2,
      "dither": false,
      "mode": "vector"
    },
    "warnings": [],
    "questions": [],
    "explanations": ["..."],
    "model": "gpt-4o-mini"
  }
}
```

**Error codes (from implementation):**

- 400 `VALIDATION_ERROR`
- 401 `UNAUTHENTICATED`
- 403 `FORBIDDEN`
- 403 `ENTITLEMENT_NOT_FOUND`
- 403 `ENTITLEMENT_NOT_ACTIVE`
- 429 `RATE_LIMITED`
- 429 `PROVIDER_RATE_LIMITED`
- 500 `INTERNAL_ERROR`
- 502 `PROVIDER_ERROR`
- 504 `PROVIDER_TIMEOUT`

**Rate limit middleware:** `global::ai-rate-limit` (per customer ID from AI token; falls back to IP)

**External upload warning:** The `image` is uploaded and sent to OpenAI for processing.

---

## Intended desktop app flow (current behavior)

1. Login to the portal and obtain a **customer JWT**.
2. Call `POST /api/v1/ai/token` to mint an **AI token**.
3. In the app, build `availableSettings` dynamically based on device, material, and current mode.
4. Use the same chat UI for both assistants.
5. An optional “include image” checkbox adds the image + `availableSettings` payload.
6. Call **either**:

- `POST /api/v1/ai/settings-assistant` (text-only), or
- `POST /api/v1/ai/engrave-assistant` (image + prompt).

7. Display `proposedPatch`, `warnings`, `questions`, and `explanations` to the user.
8. User confirms changes.
9. The app applies the patch locally. The API **never** applies settings.

## Testing

- VS Code REST Client:
  - [docs/api/http/stage1-ai-api.http](api/http/stage1-ai-api.http) (text-only assistant)
  - [docs/api/http/stage3-engrave-assistant.http](api/http/stage3-engrave-assistant.http) (multipart example; includes notes)

- Curl script for multipart (reliable for image upload):
  - [backend/test-engrave-assistant.sh](../backend/test-engrave-assistant.sh)

## Environment variables (AI)

- `OPENAI_API_KEY` (required)
- `AI_TOKEN_TTL_SECONDS` (default 900)
- `AI_OPENAI_TIMEOUT_MS` (default 15000)
- `AI_OPENAI_MODEL` (default gpt-4o-mini)
- `AI_SETTINGS_MAX_PROMPT_CHARS` (default 2000)
- `AI_SETTINGS_MAX_CONTEXT_KEYS` (default 10)
- `AI_SETTINGS_MAX_CONTEXT_VALUE_CHARS` (default 200)
- `AI_ENGRAVE_MAX_PROMPT_CHARS` (default 2000)
- `AI_ENGRAVE_MAX_CONTEXT_CHARS` (default 4000)
- `AI_ENGRAVE_MAX_SETTINGS_KEYS` (default 50)
- `AI_ENGRAVE_MAX_SETTINGS_SCHEMA_CHARS` (default 10000)
- `AI_ENGRAVE_MAX_IMAGE_BYTES` (default 5242880)
