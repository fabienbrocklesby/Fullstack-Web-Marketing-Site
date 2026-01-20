# LightLane API Test Suite (VS Code REST Client)

HTTP request files for testing the LightLane licensing API using the
**REST Client** extension by Huachao Mao (`humao.rest-client`).

## Quick Start

### 1. Install REST Client extension

In VS Code, install "REST Client" by Huachao Mao.

### 2. Set up environment

```bash
cd docs/api/http
cp .env.example .env
```

Edit `.env` and fill in `CUSTOMER_EMAIL` and `CUSTOMER_PASSWORD`.

### 3. Get your token

1. Open `00-login.http`
2. Click "Send Request" on the **Login** request
3. Copy the `token` value from the response
4. Paste it into `CUSTOMER_TOKEN` in your `.env` file

### 4. Get your entitlement ID

1. Open `10-entitlements.http`
2. Click "Send Request" on **List Entitlements**
3. Find an active entitlement and copy its `id`
4. Paste it into `ENTITLEMENT_ID` in your `.env` file

### 5. Run the test suite

Open `30-activation-stage4.http` and run requests sequentially.

## Files

| File                        | Purpose                            |
| --------------------------- | ---------------------------------- |
| `.env.example`              | Environment template (committed)   |
| `.env`                      | Your secrets (gitignored)          |
| `00-login.http`             | Smoke test + login                 |
| `10-entitlements.http`      | View customer profile/entitlements |
| `30-activation-stage4.http` | Stage 4 device activation flow     |
| `40-rate-limit-check.http`  | Rate limit testing                 |
| `stage4-smoke-test.sh`      | Automated curl smoke test          |

## Automated Smoke Test (curl)

For a fully automated test run using curl:

```bash
cd docs/api/http

# Ensure .env exists with CUSTOMER_EMAIL, CUSTOMER_PASSWORD, ENTITLEMENT_ID
./stage4-smoke-test.sh
```

This script logs in, runs all 7 Stage 4 steps, and reports pass/fail for each.

## How Variables Work

Variables are loaded from `.env` using the `{{$dotenv VAR_NAME}}` syntax.
Each `.http` file defines file-level variables at the top:

```http
@apiBase = {{$dotenv API_BASE}}
@customerToken = {{$dotenv CUSTOMER_TOKEN}}
```

**No environment switching required.** Just ensure `.env` exists in this folder.

## Stage 4 Test Flow

| Step | Request             | Expected               |
| ---- | ------------------- | ---------------------- |
| 1    | Register Device A   | 200                    |
| 2    | Activate Device A   | 200                    |
| 3    | Register Device B   | 200                    |
| 4    | Activate Device B   | **409** (maxDevices=1) |
| 5    | Refresh Device A    | 200                    |
| 6    | Deactivate Device A | 200                    |
| 7    | Activate Device B   | 200 (transfer works)   |

## Troubleshooting

- **Variables show `{{$dotenv ...}}`** → `.env` file missing. Copy from `.env.example`.
- **401 Unauthorized** → Token expired or missing. Re-run login and update `CUSTOMER_TOKEN`.
- **404 on entitlement requests** → `ENTITLEMENT_ID` not set or invalid.
- **429 Too Many Requests** → Rate limited. Wait 60 seconds.
