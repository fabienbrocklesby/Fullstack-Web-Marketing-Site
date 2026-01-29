# Portal AI API Scope

## Purpose

This project exists to make the **Portal + API layer** fully support LightLane AI features for:

- Stage 1: Settings Assistant Chat (MVP)
- Stage 2: Background Removal (MVP)

It must integrate cleanly with:

- The desktop app (client)
- Existing portal auth + licensing/entitlement model
- Existing API conventions already used by the portal backend

Stage 3 (“Image Designer”) is explicitly out of scope.

## What this project owns

### API endpoints

Owns the “AI API” endpoints exposed to the desktop app, including:

- Token minting/validation for AI calls
- Subscription/entitlement gating
- Proxying requests to AI providers (OpenAI for Stage 1; background removal provider for Stage 2)
- Strict privacy behavior (no surprise uploads, minimal payloads, redacted logs)

### Provider integration

Owns provider client wrappers, timeouts, retry policy, and request shaping.

### Documentation that must remain accurate

Owns and must keep aligned:

- API contract doc (endpoints, request/response, errors)
- Env var list and setup steps
- Test plan and smoke tests

## What this project does NOT own

- No desktop app UI work.
- No changes to the desktop app architecture (only define what the app must call).
- No changes to licensing semantics unless explicitly required (prefer reuse).
- No Stage 3 work.
- No “magic background calls” or automatic uploading. Every external call must be user-triggered.

## Hard constraints (non-negotiable)

### Security + privacy

- Treat all prompts/images as sensitive.
- Do not log raw prompts/images in plaintext.
- Explicitly show and document what content is being sent externally.
- Enforce size limits and timeouts.
- Keep provider API keys server-side only (never shipped to frontend).

### Deterministic UX + API

- Clear states, clear actions, clear errors.
- API responses should be stable and consistent.
- Prefer minimal payloads: selected layer/image + essential metadata only.

### Keep diffs small

- Don’t refactor unrelated portal code.
- Don’t change existing endpoints unless absolutely required.
- Preserve existing auth middleware, rate limits, and audit patterns.

## Definition of “Done” for this project

- Stage 1 + Stage 2 endpoints are implemented with real provider calls (no stubs).
- Entitlement gating is correct and tested.
- Documented contract matches reality exactly.
- Extensive testing exists (unit + integration + smoke).
- Dev setup is predictable (Docker/local) and documented.
