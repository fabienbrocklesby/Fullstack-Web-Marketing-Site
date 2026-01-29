# Portal AI API Contract (Stage 1 + 2)

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
| 403    | `ENTITLEMENT_NOT_ACTIVE` | Entitlement linked to token is no longer active  |
| 429    | `RATE_LIMITED`           | Too many requests                                |
| 429    | `PROVIDER_RATE_LIMITED`  | OpenAI rate limit exceeded                       |
| 500    | `INTERNAL_ERROR`         | Server misconfiguration (e.g., missing API key)  |
| 502    | `PROVIDER_ERROR`         | OpenAI returned unexpected error                 |
| 504    | `PROVIDER_TIMEOUT`       | OpenAI request timed out                         |

---

## Environment variables (AI)

| Variable                              | Default       | Description                         |
| ------------------------------------- | ------------- | ----------------------------------- |
| `OPENAI_API_KEY`                      | (required)    | OpenAI API key (server-side only)   |
| `AI_TOKEN_TTL_SECONDS`                | `900`         | AI token validity (15 minutes)      |
| `AI_OPENAI_TIMEOUT_MS`                | `15000`       | OpenAI request timeout              |
| `AI_OPENAI_MODEL`                     | `gpt-4o-mini` | OpenAI model to use                 |
| `AI_SETTINGS_MAX_PROMPT_CHARS`        | `2000`        | Max prompt length                   |
| `AI_SETTINGS_MAX_CONTEXT_KEYS`        | `10`          | Max keys in context.currentSettings |
| `AI_SETTINGS_MAX_CONTEXT_VALUE_CHARS` | `200`         | Max chars per context value         |

---

## Rate limiting

| Endpoint                             | Limit         | Key       |
| ------------------------------------ | ------------- | --------- |
| `POST /api/v1/ai/token`              | 10/min per IP | `license` |
| `POST /api/v1/ai/settings-assistant` | 10/min per IP | `ai`      |

---

## Privacy guarantees

1. Prompts and settings content are **never logged** in plaintext
2. Only metadata is logged: customerId, entitlementId, jti (truncated), latency, outcome
3. OpenAI API key is **server-side only**
4. All AI calls are **user-triggered** (no background sending)
