# Product Features & User Flows

Comprehensive catalogue of the implemented capabilities in this SaaS boilerplate (Astro + Strapi) and end‑to‑end flows for each persona: Customer and Affiliate (Marketing Partner). Includes supporting platform, operational, growth and security features.

## 1. Core Product Domains

### 1.1 Marketing & Public Site

---

## Stack Overview

### Frontend

- Astro 5.x (Hybrid SSG/SSR)
- Tailwind CSS + DaisyUI (component primitives)
- TypeScript enabled (where applicable) / modern ES modules
- Browser Tracking Utility (`JourneyTracker`)

### Backend

- Strapi v4 (Node.js Headless CMS / API layer)
- PostgreSQL (production) / SQLite (optional dev) database
- Custom controllers & routes (affiliate checkout, tracking, licensing)
- Crypto (Node `crypto` + `bs58`) for license payload security

### Tooling / DevOps

- PNPM workspaces (monorepo management)
- ESLint + Prettier + Husky + lint-staged
- Dockerfile for backend deployment
- GitHub Actions (CI scaffold)
- VS Code task automation

### Integrations

- Stripe (Checkout + Webhooks)
- Affiliate attribution (URL + cookie storage)

### Security / Integrity Components

- License activation XOR payload + Base58 encoding
- Machine binding (normalized MAC)
- Nonce hashing & structured deactivation payloads

---

### 1.2 Commerce & Licensing

- Stripe Checkout session creation with affiliate + plan metadata
- Webhook (checkout.session.completed) → purchase + license issuance
- Purchase records with product, amount, status, affiliate commission
- License Key generation per purchase (plan aware)
- License status lifecycle: unused → active → unused (on deactivation)
- Offline activation system:
  - 12‑byte payload (4 bytes license hash + 4 bytes machine hash + 4 bytes nonce)
  - Payload XOR encrypted with mixed license+machine hash key
  - Base58 compact activation codes (~16 chars)
  - Machine binding via normalized MAC address (aa:bb:cc:dd:ee:ff)
  - Nonce hashing stored (activationNonce) for single machine lock
- Offline deactivation system:
  - Structured deactivation code: Base64(JSON payload).checksum
  - JSON fields: license_key, machine_id, nonce, timestamp, app_version, validation_hash
  - Timestamp freshness validation (±48h window)
  - Machine + license key + nonce integrity validation
  - Legacy fallback: raw nonce hex mode for earlier versions
- License reset / administrative reset scripts (dev utilities)

### 1.3 Affiliate & Attribution

- Referral acquisition via `?ref=AFFILIATE_CODE` query parameter
- Cookie + localStorage persistence (30‑day retention)
- Automatic affiliate record association on purchase
- Commission calculation and accumulation per purchase
- Affiliate stats & earnings stored in backend
- Affiliate dashboard link generation
- Journey & conversion tracking (enhanced):
  - Granular actions: page_view, button_click, pricing_button_click, navigation_click, form_submit, form_field_focus, scroll depth (25/50/75/100), time milestones (30s/60s/120s), checkout_initiated, purchase_complete, registration_attempt / complete
  - Clickstream & session context (visitorId, timestamps)
  - Dual system: conversion events + visitor journey endpoint for richer funnels

### 1.4 Customer Account Portal

- Customer authentication (Strapi users-permissions based)
- Customer dashboard (license key visibility & activation status)
- Secure fetching of owned license keys only
- Activation UI workflow (machine ID collection + activation code request)
- Deactivation UI workflow (structured code submit) with validation feedback
- MAC address normalization helpers + OS command guidance (Win/macOS/Linux) for machine ID extraction

### 1.5 Content Management (CMS)

- Strapi Content Types:
  - Page (title, slug, content, SEO fields)
  - Affiliate (code, commissionRate, totals, active state, relations)
  - Purchase (amount, priceId, affiliate link, commissionAmount, metadata)
  - License Key (key, status, activationNonce, machineId, timestamps, relations)
- Admin panel for CRUD + editorial workflow

### 1.6 Payments & Revenue

- Stripe price tier mapping (Starter / Pro / Enterprise etc.)
- Metadata propagation to track affiliate + product context
- Webhook resilience pattern (secure secret validation)
- Commission derivation from price / configured percentage

### 1.7 Tracking & Analytics Infrastructure

- JourneyTracker client utility (SPA aware)
- History API interception (pushState/replaceState/popstate) for page transitions
- Scroll depth instrumentation
- Time‑on‑page milestone events
- Form engagement & sanitized field presence capture
- Button/link instrumentation (including pricing CTA differentiation)
- Global graceful failure (try/catch with console diagnostics)

### 1.8 Developer Experience & Ops

- Monorepo (pnpm workspaces) separation frontend/backend
- VS Code tasks (start all / individual / build / lint / format)
- Demo seed system with full environment provisioning
- Scripts: complete reset, quick seed, verify data, admin user creation
- Dockerfile for backend container deployment
- Environment variable templating (.env examples)
- GitHub Actions workflow (CI scaffold)
- ESLint + Prettier + Husky + lint-staged

### 1.9 Security & Integrity

- License → machine binding (prevents key reuse across devices)
- Short activation codes with cryptographic validation
- Nonce hashing (no raw nonce persistence)
- Deactivation code authenticity (nonce + machine + license + timestamp)
- Access control: customer-auth middleware on protected license routes
- CORS + environment isolation
- Secret management via env vars

### 1.10 Performance & Scalability Foundations

- Static asset optimization via Astro
- SSR/SSG hybrid readiness
- Postgres backing for production
- Separation of tracking endpoints for potential queuing / batching
- Hash truncation strategy for compact codes (balanced entropy/length)

---

## 2. Detailed User Flows

### 2.1 Customer Flow (License Consumer)

1. Acquisition: Visits marketing site (possibly via affiliate ref)
2. Purchase: Selects plan → Stripe Checkout session (affiliate metadata included)
3. Completion: Stripe webhook creates Purchase + License Key
4. Login: Customer authenticates → dashboard shows licenses
5. Activation Preparation:
   - User opens activation modal
   - Gathers MAC address (helper commands provided)
   - Submits machine ID to backend generateActivationCode endpoint
6. Activation Code Generation:
   - Backend validates license status (must be unused)
   - Builds 12‑byte payload + XOR encrypt + Base58 encode
   - Marks license active, stores hashed nonce + machineId
7. Offline App Activation (external): User pastes activation code + license key + machine ID, app decrypts, verifies, extracts nonce
8. Deactivation (when migrating machines):
   - Offline app produces structured deactivation JSON (includes nonce)
   - User submits code in dashboard
   - Backend validates structure, timestamp, license, machine, nonce
   - License status reset to unused (machine + nonce cleared)
9. Reuse: User can now activate on a new device following same steps.

Edge Cases Handled:

- Wrong license/machine combination → activation rejection
- Reuse of activation code on different license → blocked (license hash mismatch)
- Deactivation with tampered nonce / expired timestamp → rejected
- Legacy deactivation nonce format still accepted (backwards compatibility)

### 2.2 Affiliate / Marketing Partner Flow

1. Registration / Attribution:
   - Affiliate record exists (seeded or created by staff) with unique code
2. Promotion:
   - Shares pricing URL with `?ref=CODE`
   - Visitor lands → code stored (cookie + localStorage, 30 days)
3. Visitor Journey Tracking:
   - Page views, scroll depth, time, clicks, form interactions captured
   - Conversion events (checkout initiation, registration, purchase) logged
4. Conversion:
   - Customer purchases → Stripe session carries affiliate code in metadata
   - Webhook computes commission & updates affiliate totals
5. Analytics (future dashboard elements):
   - Earnings, conversion counts, clickstream (data stored, ready for UI)
6. Attribution Integrity:
   - First touch persistence via stored code
   - Tracking excludes internal team pages (login/dashboard) to avoid noise

Edge Cases Handled:

- Missing ref param: tracker uses stored cookie value
- Direct navigation after initial referral: attribution retained
- Multiple session tabs: per-tab visitorId while preserving affiliate code

---

## 3. API Surface Summary

Public / Customer Facing:

- POST /api/affiliate-checkout (create Stripe session)
- POST /api/stripe/webhook (Stripe events)
- GET /api/license-keys (customer-auth) – list owned license keys
- GET /api/license-keys/:id (customer-auth)
- POST /api/license-keys/:id/generate-activation-code (customer-auth)
- POST /api/license-keys/:id/deactivate-with-code (customer-auth)
- Tracking Endpoints:
  - POST /api/track-visitor-journey
  - POST /api/track-conversion-event
  - POST /api/track-affiliate-visit
  - GET /api/affiliate-stats

Legacy / Utility / Dev:

- POST /api/dev/create-purchase
- POST /api/dev/recalculate-commissions
- POST /api/clear-visitor-data
- POST /api/license/activate (deprecated)
- POST /api/license/deactivate (deprecated)
- POST /api/license/reset (admin/dev utility)

---

## 4. Data Model Highlights

License Key:

- key, status (unused|active), activationNonce (hashed), machineId, activatedAt
- Relations: purchase, customer

Purchase:

- amount, priceId, affiliate (relation), commissionAmount, status, metadata

Affiliate:

- code, commissionRate, totalEarnings, isActive, user relation

Tracking (Implicit / via custom collections or logs):

- Visitor journeys with action events and timestamps
- Conversion event records (click, purchase, etc.)

---

## 5. Security Considerations Implemented

- Activation code cryptographic binding: license + machine
- Nonce randomness (4 bytes) hashed for storage
- Deactivation payload integrity and freshness checks
- Machine ID normalization prevents spoof via variant formatting
- Customer middleware gating license endpoints
- Minimal footprint exposure: short codes reduce leak copying errors
- Graceful fallback to legacy deactivation to avoid stranded licenses

---

## 6. Operational Tooling

- Demo seeding commands (complete / quick / verify)
- License reset scripts for support
- VS Code tasks for parallel dev start
- Dockerized backend for consistent deployment
- GitHub Actions CI scaffold

---

## 7. Extensibility Opportunities (Roadmap)

- Email notifications (purchase, activation, commission earned)
- Payout scheduling & withdrawal workflows
- Multi-tier affiliate (sub‑affiliate) structure
- Subscription (recurring billing) support
- In-app analytics dashboard for affiliates & customers
- Rate limiting + audit logging
- Encrypted local license cache for offline desktop app
- Enhanced fraud detection (device fingerprint beyond MAC)

---

## 8. Quick Glossary

- Activation Code: Short Base58 string unlocking license for one machine
- Nonce: Random 4 bytes identifying this activation instance
- Deactivation Code: Structured signed payload enabling server to release lock
- Machine ID: Normalized MAC address used as device fingerprint
- Affiliate Code: Human string appended as ?ref= param for attribution

---

Generated automatically from current codebase & documentation snapshot.

---

## 9. Strapi Collections & Schemas

Below is a concise description of each Strapi content type and its attribute structure (derived from current schema.json files). Types reflect Strapi field kinds; defaults and constraints noted where relevant.

### 9.1 Customer (`api::customer.customer`)

| Field                | Type                                                    | Notes                          |
| -------------------- | ------------------------------------------------------- | ------------------------------ |
| email                | email (unique, required)                                | Primary contact / identifier   |
| firstName            | string (required)                                       |                                |
| lastName             | string (required)                                       |                                |
| password             | string (private, required)                              | Hashed by Strapi auth pipeline |
| isActive             | boolean (default: true)                                 | Soft enable/disable            |
| emailVerified        | boolean (default: false)                                | Verification status            |
| stripeCustomerId     | string (unique)                                         | Mapping to Stripe Customer     |
| purchases            | relation oneToMany -> Purchase (mappedBy `customer`)    | Reverse link                   |
| licenseKeys          | relation oneToMany -> License Key (mappedBy `customer`) | Reverse link                   |
| resetPasswordToken   | string (private)                                        | Password reset flow            |
| resetPasswordExpires | datetime (private)                                      | Token TTL                      |

### 9.2 Affiliate (`api::affiliate.affiliate`)

| Field            | Type                                                  | Notes                             |
| ---------------- | ----------------------------------------------------- | --------------------------------- |
| code             | uid (targets `name`)                                  | Unique public affiliate code      |
| name             | string (required)                                     | Display name                      |
| email            | email (unique, required)                              | Contact / login linkage           |
| user             | relation oneToOne -> users-permissions.user           | Optional platform user link       |
| payoutDetails    | json                                                  | Flexible payout meta              |
| commissionRate   | decimal (default: 0.1, 0–1)                           | Commission percentage             |
| totalEarnings    | decimal (default: 0)                                  | Accumulated gross commission      |
| isActive         | boolean (default: true)                               | Active status toggle              |
| purchases        | relation oneToMany -> Purchase (mappedBy `affiliate`) | Reverse association               |
| joinedAt         | datetime                                              | First activation date             |
| notes            | text                                                  | Internal remarks                  |
| metadata         | json                                                  | Arbitrary structured data         |
| conversionEvents | json                                                  | Cached/historical event artifacts |

### 9.3 Purchase (`api::purchase.purchase`)

| Field            | Type                                                     | Notes                                         |
| ---------------- | -------------------------------------------------------- | --------------------------------------------- |
| stripeSessionId  | string (unique, required)                                | Stripe checkout session reference             |
| amount           | decimal (required)                                       | Gross amount (minor currency units if chosen) |
| currency         | string (default: "usd")                                  | ISO currency code                             |
| customerEmail    | email                                                    | Redundant denormalized field                  |
| priceId          | string (required)                                        | Stripe price ID                               |
| affiliate        | relation manyToOne -> Affiliate (inversedBy `purchases`) | Attribution source                            |
| customer         | relation manyToOne -> Customer (inversedBy `purchases`)  | Purchasing customer                           |
| licenseKey       | relation oneToOne -> License Key                         | Issued key link                               |
| commissionAmount | decimal (default: 0)                                     | Calculated commission value                   |
| commissionPaid   | boolean (default: false)                                 | Payout status                                 |
| metadata         | json                                                     | Stripe or internal meta                       |

### 9.4 License Key (`api::license-key.license-key`)

| Field              | Type                                                         | Notes                                            |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------ |
| key                | string (unique, required)                                    | Actual license key string                        |
| productName        | string (required)                                            | Human product label                              |
| priceId            | string (required)                                            | Stripe price cross-reference                     |
| customer           | relation manyToOne -> Customer (inversedBy `licenseKeys`)    | Owner                                            |
| purchase           | relation oneToOne -> Purchase                                | Source purchase                                  |
| isActive           | boolean (default: true)                                      | Legacy activation flag                           |
| status             | enum [unused, active] (default: unused)                      | Authoritative activation status                  |
| jti                | string                                                       | Runtime activation identifier (JWT style)        |
| machineId          | string                                                       | Bound machine fingerprint (normalized MAC)       |
| typ                | enum [trial, paid, starter, pro, enterprise] (default: paid) | License classification                           |
| trialStart         | datetime                                                     | Trial start marker                               |
| isUsed             | boolean (legacy, default: false)                             | Backward compatibility field                     |
| deviceInfo         | json                                                         | Optional device metadata                         |
| activatedAt        | datetime                                                     | Activation timestamp                             |
| expiresAt          | datetime                                                     | Expiration date (if any)                         |
| maxActivations     | integer (default: 1, min:1)                                  | Policy ceiling                                   |
| currentActivations | integer (default: 0)                                         | Usage counter (future multi-activation)          |
| deactivationCode   | text                                                         | Stored encrypted deactivation artifact (legacy)  |
| activationNonce    | string                                                       | Hashed nonce for offline deactivation validation |

### 9.5 Page (`api::page.page`)

| Field          | Type                                                                 | Notes                             |
| -------------- | -------------------------------------------------------------------- | --------------------------------- |
| title          | string (required)                                                    | Page title                        |
| slug           | uid (targets title, required)                                        | URL segment                       |
| sections       | dynamiczone (hero, feature-grid, testimonial, cta, content, pricing) | Modular content blocks            |
| content        | richtext                                                             | Long-form body                    |
| seoTitle       | string (≤60 chars)                                                   | Meta title                        |
| seoDescription | text (≤160 chars)                                                    | Meta description                  |
| seoImage       | media (image)                                                        | Social / OG image                 |
| seoKeywords    | text                                                                 | Comma or space separated keywords |

### 9.6 License (Legacy / Placeholder) (`api::license.license`)

| Field  | Type | Notes                                                 |
| ------ | ---- | ----------------------------------------------------- |
| (none) | —    | Placeholder collection for JWT-based portal evolution |

---

### Relationships Overview

- Customer 1—\* Purchase
- Customer 1—\* License Key
- Affiliate 1—\* Purchase
- Purchase 1—1 License Key
- License Key \*—1 Customer / 1—1 Purchase

---

End of extended Strapi schema section.
