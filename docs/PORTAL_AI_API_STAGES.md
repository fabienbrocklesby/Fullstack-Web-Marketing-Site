# Portal AI API Stages

This is the staged delivery plan for the Portal + AI API layer.
The goal is to ship Stage 1 + Stage 2, and stop.

## Stage 0 — Baseline + Contract Lock

### Goals

- Confirm current portal backend structure (routes/controllers/services/middleware).
- Confirm existing licensing/entitlement model and how the desktop app authenticates.
- Lock the API contract for Stage 1 + Stage 2:
  - endpoints
  - request/response envelopes
  - error codes + statuses
  - auth/token model

### Deliverables

- `PORTAL_AI_API_CONTRACT.md` finalized
- env var list + local setup steps
- “known drift” section if current code differs from contract

### Exit criteria

- Contract doc matches implementation or has a tracked gap list with owners.

## Stage 1 — Settings Assistant (MVP) via Portal AI API

### Goals

- Desktop app can call a portal endpoint with:
  - AI token auth
  - minimal settings/canvas context payload (never whole canvas by default)
- Portal validates entitlement and proxies to OpenAI.
- Portal returns a deterministic response envelope.

### Must-have behaviors

- Explicit user-triggered call (no background sending).
- Clear size limits + timeouts.
- Redacted logging.
- Stable error mapping for the app.

### Exit criteria

- End-to-end: app → portal → OpenAI → portal → app works.
- Unit tests for gating + payload validation.
- Integration/smoke tests in repo.

## Stage 2 — Background Removal (MVP) via Portal AI API

### Goals

- Desktop app can send a single raster image (or image URL if that’s the existing portal pattern).
- Portal validates entitlement and proxies to the background removal provider.
- Portal returns:
  - either a signed URL to the result, or
  - raw bytes (only if existing infrastructure supports it cleanly)

### Provider choice policy

- Prefer the simplest provider that fits:
  - predictable latency
  - reasonable pricing
  - no sketchy data retention
- Keys server-side only.

### Exit criteria

- End-to-end background removal works reliably with size limits.
- Tests cover:
  - allowed/denied entitlements
  - oversized payload failure
  - provider errors mapped cleanly

## Non-goal: Stage 3

Stage 3 (“Image Designer”) is intentionally excluded from this project.
