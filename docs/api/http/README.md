# LightLane API Test Suite

HTTP request files for manual testing with VS Code REST Client, plus
automated shell-based smoke tests.

## Directory Structure

```
docs/api/http/
├── .env                      # Your local config (gitignored)
├── .env.example              # Template with defaults
├── README.md                 # This file
│
├── shared/                   # Common requests (login, entitlements)
│   ├── login.http            # Get JWT token
│   └── entitlements.http     # View customer entitlements
│
├── stage4/                   # Stage 4: Device activation
│   ├── activation.http       # Full activation flow (register/activate/refresh/deactivate)
│   ├── rate-limit.http       # Rate limit testing
│   └── smoke-test.sh         # Automated Stage 4 test
│
└── stage5/                   # Stage 5.5: Licensing validation
    ├── lease-refresh.http    # Online lease refresh
    ├── offline-refresh.http  # Subscription offline refresh (challenge/response)
    ├── legacy-retired.http   # Retired endpoints (410 Gone)
    └── smoke-test.sh         # Automated Stage 5.5 test
```

## Quick Start

### 1. Seed test data

```bash
# Creates test customer + subscription + lifetime entitlements
# Idempotent: safe to run multiple times
make seed-test-customer
```

### 2. Run smoke tests

```bash
# Run all smoke tests
make smoke

# Run individually:
make smoke-stage5    # Stage 5.5: legacy 410 + offline refresh + full flow
make smoke-stage4    # Stage 4: device activation + maxDevices

# Run with cleanup (removes test device activations after tests):
SMOKE_CLEANUP=1 make smoke-stage5
SMOKE_CLEANUP=1 make smoke-stage4
```

### 3. Manual testing (optional)

If you want to use VS Code REST Client for manual testing:

1. Install the "REST Client" VS Code extension
2. Copy `.env.example` to `.env`
3. Run `make seed-test-customer` to populate test credentials
4. Open any `.http` file and click "Send Request"

## Environment Variables

The `.env` file contains:

```bash
# API endpoint
API_URL=http://127.0.0.1:1337

# Test customer (created by make seed-test-customer)
TEST_CUSTOMER_EMAIL=smoketest@example.com
TEST_CUSTOMER_PASSWORD=SmokeTest123!

# Test device (used by smoke tests)
TEST_DEVICE_ID=smoke-test-device-001

# For REST Client (optional - copy JWT here after login)
JWT=
```

**Smoke tests require `TEST_CUSTOMER_*` variables.** They will fail with clear
instructions if not set.

## Smoke Tests

### Stage 5.5 Smoke Test (`make smoke-stage5`)

Full licensing validation including Stage 5.5 features:

| Test                                 | Expected |
| ------------------------------------ | -------- |
| Customer login                       | 200      |
| Fetch entitlements                   | 200      |
| Device registration                  | 200      |
| License activation                   | 200      |
| Lease refresh                        | 200      |
| Subscription offline challenge       | 200      |
| Lifetime offline challenge (blocked) | 400/403  |
| Legacy endpoints (retired)           | 410      |
| Device deactivation                  | 200      |

Exit codes:

- `0` = All tests passed
- `1` = Test failure
- `2` = Rate limited (429) - wait 60s and retry
- `3` = Missing prerequisites (run `make seed-test-customer`)

### Stage 4 Smoke Test (`make smoke-stage4`)

Device-based activation flow with maxDevices enforcement:

| Test                                          | Expected |
| --------------------------------------------- | -------- |
| Customer login                                | 200      |
| Fetch entitlements (auto-select subscription) | 200      |
| Device A registration                         | 200      |
| Device A activation                           | 200      |
| Device A lease refresh                        | 200      |
| Device B registration                         | 200      |
| Device B activation (blocked)                 | 409/400  |
| Device A deactivation                         | 200      |
| Device B activation (succeeds)                | 200      |

Exit codes: Same as Stage 5.5.

## Cleanup Option

Both smoke tests support optional cleanup:

```bash
# Via environment variable:
SMOKE_CLEANUP=1 ./docs/api/http/stage5/smoke-test.sh

# Via flag:
./docs/api/http/stage5/smoke-test.sh --cleanup

# Via make:
SMOKE_CLEANUP=1 make smoke
```

Cleanup deactivates test devices after tests. Useful for CI or repeated runs.

## Troubleshooting

### API not reachable

```bash
make up      # Start Docker stack
make logs    # View logs
```

### Smoke tests fail with "Missing required env vars"

```bash
make seed-test-customer  # Creates test customer + populates .env
source docs/api/http/.env  # Load env vars into shell
```

### Rate limited (429)

Wait 60 seconds and retry. Rate limits:

- `authRateLimit`: 5/min (login)
- `licenseRateLimit`: 10/min (activate, refresh, deactivate)
- `apiRateLimit`: 30/min (general endpoints)

### Variables show `{{$dotenv ...}}`

- Install VS Code "REST Client" extension
- Ensure `.env` file exists with values populated
