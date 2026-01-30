#!/usr/bin/env bash
# Stage 5.5 Licensing Validation Smoke Test
# Requirements: jq, curl
# Usage: 
#   SMOKE_CLEANUP=1 ./smoke-test.sh  # Run tests and cleanup at end
#   ./smoke-test.sh --cleanup        # Run tests and cleanup at end
#   ./smoke-test.sh                  # Run tests, leave test data
#
# Environment variables (required):
#   TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_PASSWORD
# Environment variables (optional):
#   API_URL (default: http://127.0.0.1:1337)
#   TEST_DEVICE_ID (default: smoke-test-device-001)
#   SMOKE_CLEANUP (set to 1 to cleanup after tests)
#
# This script tests the Stage 5.5 licensing API endpoints:
# - Device registration + lease token retrieval
# - Subscription offline refresh flow (challenge/response)
# - Legacy endpoint retirement (HTTP 410)
# - Rate limit detection (exit cleanly on 429)
#
# Exit codes:
#   0 = All tests passed
#   1 = Test failure
#   2 = Rate limited (429)
#   3 = Missing prerequisites

set -euo pipefail

########################################
# Config
########################################
API_URL="${API_URL:-http://127.0.0.1:1337}"
TEST_DEVICE_ID="${TEST_DEVICE_ID:-smoke-test-device-001}"
DO_CLEANUP=0

# Parse --cleanup flag
for arg in "$@"; do
  case $arg in
    --cleanup) DO_CLEANUP=1 ;;
  esac
done
[ "${SMOKE_CLEANUP:-0}" = "1" ] && DO_CLEANUP=1

########################################
# Colors
########################################
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

########################################
# Counters
########################################
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

########################################
# Helpers
########################################
log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_pass()  { echo -e "${GREEN}[PASS]${NC} $1"; }
log_fail()  { echo -e "${RED}[FAIL]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_section() { echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

assert_equals() {
  TESTS_RUN=$((TESTS_RUN + 1))
  local expected="$1"
  local actual="$2"
  local msg="$3"
  if [ "$expected" = "$actual" ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "$msg"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "$msg (expected: $expected, got: $actual)"
  fi
}

assert_not_empty() {
  TESTS_RUN=$((TESTS_RUN + 1))
  local value="$1"
  local msg="$2"
  if [ -n "$value" ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "$msg"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "$msg (value was empty)"
  fi
}

assert_contains() {
  TESTS_RUN=$((TESTS_RUN + 1))
  local haystack="$1"
  local needle="$2"
  local msg="$3"
  if echo "$haystack" | grep -q "$needle"; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "$msg"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "$msg (expected to contain: $needle)"
  fi
}

# Check for rate limiting - exit cleanly with code 2 if hit
check_rate_limit() {
  local http_code="$1"
  local endpoint="$2"
  if [ "$http_code" = "429" ]; then
    log_warn "Rate limited on $endpoint (HTTP 429). Exiting cleanly."
    log_warn "Wait ~60 seconds and retry, or check rate limit configuration."
    print_summary
    exit 2
  fi
}

print_summary() {
  log_section "Test Summary"
  echo -e "Tests run:    $TESTS_RUN"
  echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC}"
  echo -e "Tests failed: ${RED}$TESTS_FAILED${NC}"
  if [ "$DO_CLEANUP" = "1" ]; then
    echo -e "Cleanup:      ${YELLOW}enabled${NC}"
  fi
}

########################################
# Prerequisites
########################################
log_section "Prerequisites Check"

if [ -z "${TEST_CUSTOMER_EMAIL:-}" ] || [ -z "${TEST_CUSTOMER_PASSWORD:-}" ]; then
  log_fail "Missing required env vars: TEST_CUSTOMER_EMAIL, TEST_CUSTOMER_PASSWORD"
  log_info "Run 'make seed-test-customer' first, then source the .env file:"
  log_info "  source docs/api/http/.env"
  exit 3
fi

command -v jq >/dev/null 2>&1 || { log_fail "jq is required but not installed"; exit 3; }
command -v curl >/dev/null 2>&1 || { log_fail "curl is required but not installed"; exit 3; }

log_info "API_URL: $API_URL"
log_info "TEST_CUSTOMER_EMAIL: $TEST_CUSTOMER_EMAIL"
log_info "TEST_DEVICE_ID: $TEST_DEVICE_ID"
log_info "Cleanup: $([ "$DO_CLEANUP" = "1" ] && echo "enabled" || echo "disabled")"

########################################
# 1. Customer Login
########################################
log_section "1. Customer Login"

LOGIN_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/customers/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_CUSTOMER_EMAIL\", \"password\": \"$TEST_CUSTOMER_PASSWORD\"}")

LOGIN_BODY=$(echo "$LOGIN_RESPONSE" | sed '$d')
LOGIN_STATUS=$(echo "$LOGIN_RESPONSE" | tail -1)

check_rate_limit "$LOGIN_STATUS" "/api/customers/login"
assert_equals "200" "$LOGIN_STATUS" "Customer login returns 200"

JWT=$(echo "$LOGIN_BODY" | jq -r '.token // empty')
assert_not_empty "$JWT" "JWT token received"

USER_ID=$(echo "$LOGIN_BODY" | jq -r '.customer.id // empty')
assert_not_empty "$USER_ID" "User ID received"

log_info "Logged in as user ID: $USER_ID"

########################################
# 2. Fetch Entitlements
########################################
log_section "2. Fetch Entitlements"

ENT_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/api/customers/me/entitlements" \
  -H "Authorization: Bearer $JWT")

ENT_BODY=$(echo "$ENT_RESPONSE" | sed '$d')
ENT_STATUS=$(echo "$ENT_RESPONSE" | tail -1)

check_rate_limit "$ENT_STATUS" "/api/customers/me/entitlements"
assert_equals "200" "$ENT_STATUS" "Fetch entitlements returns 200"

# Stage 6A: Check for ok boolean in response
ENT_OK=$(echo "$ENT_BODY" | jq -r '.ok // "missing"')
assert_equals "true" "$ENT_OK" "Fetch entitlements response has ok: true"

ENT_COUNT=$(echo "$ENT_BODY" | jq '.entitlements | length')
log_info "Found $ENT_COUNT entitlements"

# Regression: Verify entitlements array is not empty when expected
# This guards against the bug where entitlements silently return empty
if [ "$ENT_COUNT" -eq 0 ]; then
  log_warn "No entitlements found - verify test customer has at least one entitlement"
else
  TESTS_RUN=$((TESTS_RUN + 1))
  TESTS_PASSED=$((TESTS_PASSED + 1))
  log_pass "Entitlements array is non-empty (count: $ENT_COUNT)"
fi

# Regression: Verify leaseRequired field is present on entitlements
# This is critical for offline provisioning UI to filter subscriptions correctly
FIRST_ENT_LEASE_REQUIRED=$(echo "$ENT_BODY" | jq -r '.entitlements[0].leaseRequired // "missing"')
if [ "$ENT_COUNT" -gt 0 ]; then
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$FIRST_ENT_LEASE_REQUIRED" != "missing" ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Entitlements include leaseRequired field"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "Entitlements missing leaseRequired field (needed for offline provisioning)"
  fi
fi

# Find a subscription entitlement (isLifetime=false) for offline refresh testing
SUBSCRIPTION_ENT=$(echo "$ENT_BODY" | jq -r '.entitlements[] | select(.isLifetime == false) | .id' | head -1)
LIFETIME_ENT=$(echo "$ENT_BODY" | jq -r '.entitlements[] | select(.isLifetime == true) | .id' | head -1)

# Regression: Verify offline provisioning eligibility rules
# Rule 1: Lifetime entitlements should NOT be eligible
if [ -n "$LIFETIME_ENT" ]; then
  LIFETIME_IS_LIFETIME=$(echo "$ENT_BODY" | jq -r --argjson id "$LIFETIME_ENT" '.entitlements[] | select(.id == $id) | .isLifetime')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$LIFETIME_IS_LIFETIME" = "true" ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Lifetime entitlement correctly has isLifetime=true (not eligible for offline)"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "Lifetime entitlement has unexpected isLifetime value: $LIFETIME_IS_LIFETIME"
  fi
fi

# Rule 2: Active subscription should be eligible (has required fields)
if [ -n "$SUBSCRIPTION_ENT" ]; then
  SUB_STATUS=$(echo "$ENT_BODY" | jq -r --argjson id "$SUBSCRIPTION_ENT" '.entitlements[] | select(.id == $id) | .status')
  SUB_MAX_DEVICES=$(echo "$ENT_BODY" | jq -r --argjson id "$SUBSCRIPTION_ENT" '.entitlements[] | select(.id == $id) | .maxDevices')
  
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$SUB_STATUS" = "active" ] || [ "$SUB_STATUS" = "trialing" ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Subscription entitlement has eligible status: $SUB_STATUS"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "Subscription entitlement has non-eligible status: $SUB_STATUS (expected active or trialing)"
  fi
  
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$SUB_MAX_DEVICES" != "null" ] && [ "$SUB_MAX_DEVICES" -ge 1 ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Subscription entitlement has maxDevices: $SUB_MAX_DEVICES"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "Subscription entitlement missing or invalid maxDevices: $SUB_MAX_DEVICES"
  fi
fi

if [ -n "$SUBSCRIPTION_ENT" ]; then
  log_info "Found subscription entitlement (ID: $SUBSCRIPTION_ENT) for offline refresh test"
else
  log_warn "No subscription entitlement found - offline refresh test will be skipped"
fi

if [ -n "$LIFETIME_ENT" ]; then
  log_info "Found lifetime entitlement (ID: $LIFETIME_ENT)"
fi

########################################
# 3. Device Registration
########################################
log_section "3. Device Registration"

PUBLIC_KEY="smoke-test-public-key-$(date +%s)"

REG_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/device/register" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\": \"$TEST_DEVICE_ID\", \"publicKey\": \"$PUBLIC_KEY\", \"platform\": \"macos\", \"deviceName\": \"Smoke Test Device\"}")

REG_BODY=$(echo "$REG_RESPONSE" | sed '$d')
REG_STATUS=$(echo "$REG_RESPONSE" | tail -1)

check_rate_limit "$REG_STATUS" "/api/device/register"

# Accept 200 (new device) or 200 with existing device
if [ "$REG_STATUS" = "200" ]; then
  TESTS_RUN=$((TESTS_RUN + 1))
  TESTS_PASSED=$((TESTS_PASSED + 1))
  log_pass "Device registration returns 200"
  
  # Stage 6A: Check for ok boolean
  REG_OK=$(echo "$REG_BODY" | jq -r '.ok // "missing"')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$REG_OK" = "true" ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Device registration response has ok: true"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "Device registration response missing ok: true (got: $REG_OK)"
  fi
  
  DEVICE_DB_ID=$(echo "$REG_BODY" | jq -r '.data.id // empty')
  log_info "Device registered/updated (DB ID: $DEVICE_DB_ID)"
else
  TESTS_RUN=$((TESTS_RUN + 1))
  TESTS_FAILED=$((TESTS_FAILED + 1))
  log_fail "Device registration failed (status: $REG_STATUS)"
  log_info "Response: $REG_BODY"
fi

########################################
# 4. License Activation
########################################
log_section "4. License Activation"

# Use subscription entitlement if available, otherwise any entitlement
TEST_ENT="${SUBSCRIPTION_ENT:-$LIFETIME_ENT}"

if [ -z "$TEST_ENT" ]; then
  log_warn "No entitlements available - skipping activation test"
else
  ACT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/licence/activate" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"deviceId\": \"$TEST_DEVICE_ID\", \"entitlementId\": $TEST_ENT}")

  ACT_BODY=$(echo "$ACT_RESPONSE" | sed '$d')
  ACT_STATUS=$(echo "$ACT_RESPONSE" | tail -1)

  check_rate_limit "$ACT_STATUS" "/api/licence/activate"
  assert_equals "200" "$ACT_STATUS" "License activation returns 200"
  
  # Stage 6A: Check for ok boolean
  ACT_OK=$(echo "$ACT_BODY" | jq -r '.ok // "missing"')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$ACT_OK" = "true" ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "License activation response has ok: true"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "License activation response missing ok: true (got: $ACT_OK)"
  fi
  
  # Activation returns ok/message/entitlement/device, not a lease token
  # Lease token is obtained via /api/licence/refresh
  DEVICE_BOUND=$(echo "$ACT_BODY" | jq -r '.device.boundAt // empty')
  assert_not_empty "$DEVICE_BOUND" "Device binding confirmed"
  
  log_info "Device bound at: $DEVICE_BOUND"
fi

########################################
# 5. Lease Refresh
########################################
log_section "5. Lease Refresh"

if [ -z "${TEST_ENT:-}" ]; then
  log_warn "No entitlement - skipping refresh test"
else
  REFRESH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/licence/refresh" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"deviceId\": \"$TEST_DEVICE_ID\", \"entitlementId\": $TEST_ENT}")

  REFRESH_BODY=$(echo "$REFRESH_RESPONSE" | sed '$d')
  REFRESH_STATUS=$(echo "$REFRESH_RESPONSE" | tail -1)

  check_rate_limit "$REFRESH_STATUS" "/api/licence/refresh"
  assert_equals "200" "$REFRESH_STATUS" "Lease refresh returns 200"

  # Stage 6A: Check for ok boolean
  REFRESH_OK=$(echo "$REFRESH_BODY" | jq -r '.ok // "missing"')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$REFRESH_OK" = "true" ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Lease refresh response has ok: true"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "Lease refresh response missing ok: true (got: $REFRESH_OK)"
  fi

  LEASE_TOKEN=$(echo "$REFRESH_BODY" | jq -r '.leaseToken // empty')
  assert_not_empty "$LEASE_TOKEN" "Lease token received on refresh"
  
  LEASE_EXPIRY=$(echo "$REFRESH_BODY" | jq -r '.leaseExpiresAt // empty')
  log_info "Lease expires: $LEASE_EXPIRY"
fi

########################################
# 6. Subscription Offline Refresh (Challenge/Response)
########################################
log_section "6. Subscription Offline Refresh"

if [ -z "$SUBSCRIPTION_ENT" ]; then
  log_warn "No subscription entitlement - skipping offline refresh test"
else
  # Step 1: Get challenge (requires both entitlementId and deviceId)
  CHALLENGE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/licence/offline-challenge" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"entitlementId\": $SUBSCRIPTION_ENT, \"deviceId\": \"$TEST_DEVICE_ID\"}")

  CHALLENGE_BODY=$(echo "$CHALLENGE_RESPONSE" | sed '$d')
  CHALLENGE_STATUS=$(echo "$CHALLENGE_RESPONSE" | tail -1)

  check_rate_limit "$CHALLENGE_STATUS" "/api/licence/offline-challenge"
  assert_equals "200" "$CHALLENGE_STATUS" "Offline challenge returns 200"

  # Stage 6A: Check for ok boolean and renamed fields
  CHALLENGE_OK=$(echo "$CHALLENGE_BODY" | jq -r '.ok // "missing"')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$CHALLENGE_OK" = "true" ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Offline challenge response has ok: true"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "Offline challenge response missing ok: true (got: $CHALLENGE_OK)"
  fi

  # Stage 6A: Field renamed from 'challenge' to 'challengeToken'
  CHALLENGE=$(echo "$CHALLENGE_BODY" | jq -r '.challengeToken // empty')
  assert_not_empty "$CHALLENGE" "Challenge token received (challengeToken field)"

  # Step 2: Submit response (simulate - in real use, app would sign this)
  OFFLINE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/licence/offline-refresh" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"entitlementId\": $SUBSCRIPTION_ENT, \"deviceId\": \"$TEST_DEVICE_ID\", \"challenge\": \"$CHALLENGE\", \"signature\": \"test-signature\"}")

  OFFLINE_BODY=$(echo "$OFFLINE_RESPONSE" | sed '$d')
  OFFLINE_STATUS=$(echo "$OFFLINE_RESPONSE" | tail -1)

  # Stage 6A: Check response has proper ok/code structure (even on failure)
  OFFLINE_OK=$(echo "$OFFLINE_BODY" | jq -r '.ok // "missing"')
  
  # This may fail signature validation (expected) - we're just testing the endpoint exists
  # and returns proper response structure
  if [ "$OFFLINE_STATUS" = "200" ]; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Offline refresh succeeded (status: 200)"
    
    # Verify ok: true on success
    TESTS_RUN=$((TESTS_RUN + 1))
    if [ "$OFFLINE_OK" = "true" ]; then
      TESTS_PASSED=$((TESTS_PASSED + 1))
      log_pass "Offline refresh response has ok: true"
    else
      TESTS_FAILED=$((TESTS_FAILED + 1))
      log_fail "Offline refresh response missing ok: true (got: $OFFLINE_OK)"
    fi
  elif [ "$OFFLINE_STATUS" = "400" ] || [ "$OFFLINE_STATUS" = "409" ]; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Offline refresh endpoint responds (status: $OFFLINE_STATUS - validation/replay error)"
    
    # Verify ok: false and code on error
    TESTS_RUN=$((TESTS_RUN + 1))
    OFFLINE_CODE=$(echo "$OFFLINE_BODY" | jq -r '.code // "missing"')
    if [ "$OFFLINE_OK" = "false" ] && [ "$OFFLINE_CODE" != "missing" ]; then
      TESTS_PASSED=$((TESTS_PASSED + 1))
      log_pass "Offline refresh error response has ok: false and code: $OFFLINE_CODE"
    else
      TESTS_FAILED=$((TESTS_FAILED + 1))
      log_fail "Offline refresh error response missing proper structure (ok: $OFFLINE_OK, code: $OFFLINE_CODE)"
    fi
  else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "Offline refresh unexpected status: $OFFLINE_STATUS"
  fi
fi

########################################
# 7. Lifetime Entitlement - Offline Refresh Blocked
########################################
log_section "7. Lifetime Entitlement - Offline Refresh Blocked"

if [ -z "$LIFETIME_ENT" ]; then
  log_warn "No lifetime entitlement - skipping blocked offline refresh test"
else
  LIFETIME_CHALLENGE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/licence/offline-challenge" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"entitlementId\": $LIFETIME_ENT, \"deviceId\": \"$TEST_DEVICE_ID\"}")

  LIFETIME_BODY=$(echo "$LIFETIME_CHALLENGE" | sed '$d')
  LIFETIME_STATUS=$(echo "$LIFETIME_CHALLENGE" | tail -1)

  check_rate_limit "$LIFETIME_STATUS" "/api/licence/offline-challenge"
  
  # Should return 400 or 403 - lifetime entitlements don't support offline refresh
  # Stage 6A: Also check error code is LIFETIME_NOT_SUPPORTED
  if [ "$LIFETIME_STATUS" = "400" ] || [ "$LIFETIME_STATUS" = "403" ]; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Lifetime entitlement offline challenge blocked (status: $LIFETIME_STATUS)"
    
    # Verify error code
    LIFETIME_CODE=$(echo "$LIFETIME_BODY" | jq -r '.code // "missing"')
    TESTS_RUN=$((TESTS_RUN + 1))
    if [ "$LIFETIME_CODE" = "LIFETIME_NOT_SUPPORTED" ]; then
      TESTS_PASSED=$((TESTS_PASSED + 1))
      log_pass "Lifetime entitlement error code: LIFETIME_NOT_SUPPORTED"
    else
      TESTS_FAILED=$((TESTS_FAILED + 1))
      log_fail "Lifetime entitlement should have code LIFETIME_NOT_SUPPORTED (got: $LIFETIME_CODE)"
    fi
  else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "Lifetime entitlement offline challenge should be blocked (got: $LIFETIME_STATUS)"
  fi
fi

########################################
# 8. Legacy Endpoints - Should Return 410
########################################
log_section "8. Legacy Endpoints Retired (HTTP 410)"

# Legacy activation endpoint (retired) - was POST /api/license/activate
# Send empty body - we're only checking the endpoint returns 410
LEGACY_ACTIVATE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/license/activate" \
  -H "Content-Type: application/json" \
  -d '{}')

LEGACY_ACTIVATE_STATUS=$(echo "$LEGACY_ACTIVATE" | tail -1)
check_rate_limit "$LEGACY_ACTIVATE_STATUS" "/api/license/activate"

if [ "$LEGACY_ACTIVATE_STATUS" = "410" ]; then
  TESTS_RUN=$((TESTS_RUN + 1))
  TESTS_PASSED=$((TESTS_PASSED + 1))
  log_pass "/api/license/activate returns 410 Gone (retired)"
  
  # Stage 6A: Check retired response has ok: false and code: RETIRED_ENDPOINT
  LEGACY_ACTIVATE_BODY=$(echo "$LEGACY_ACTIVATE" | sed '$d')
  # Use jq's raw output - boolean false becomes string "false"
  LEGACY_OK=$(echo "$LEGACY_ACTIVATE_BODY" | jq -r 'if .ok == false then "false" elif .ok == true then "true" else "missing" end')
  LEGACY_CODE=$(echo "$LEGACY_ACTIVATE_BODY" | jq -r '.code // "missing"')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$LEGACY_OK" = "false" ] && [ "$LEGACY_CODE" = "RETIRED_ENDPOINT" ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Retired endpoint has ok: false and code: RETIRED_ENDPOINT"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "Retired endpoint response structure incorrect (ok: $LEGACY_OK, code: $LEGACY_CODE)"
  fi
else
  TESTS_RUN=$((TESTS_RUN + 1))
  TESTS_FAILED=$((TESTS_FAILED + 1))
  log_fail "/api/license/activate should return 410 Gone (got HTTP $LEGACY_ACTIVATE_STATUS)"
fi

# Legacy deactivation endpoint (retired) - was POST /api/license/deactivate
LEGACY_DEACTIVATE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/license/deactivate" \
  -H "Content-Type: application/json" \
  -d '{}')

LEGACY_DEACTIVATE_STATUS=$(echo "$LEGACY_DEACTIVATE" | tail -1)
check_rate_limit "$LEGACY_DEACTIVATE_STATUS" "/api/license/deactivate"

if [ "$LEGACY_DEACTIVATE_STATUS" = "410" ]; then
  TESTS_RUN=$((TESTS_RUN + 1))
  TESTS_PASSED=$((TESTS_PASSED + 1))
  log_pass "/api/license/deactivate returns 410 Gone (retired)"
else
  TESTS_RUN=$((TESTS_RUN + 1))
  TESTS_FAILED=$((TESTS_FAILED + 1))
  log_fail "/api/license/deactivate should return 410 Gone (got HTTP $LEGACY_DEACTIVATE_STATUS)"
fi

########################################
# 9. Device Deactivation
########################################
log_section "9. Device Deactivation"

if [ -z "${TEST_ENT:-}" ]; then
  log_warn "No entitlement - skipping deactivation test"
else
  DEACT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/licence/deactivate" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"deviceId\": \"$TEST_DEVICE_ID\", \"entitlementId\": $TEST_ENT}")

  DEACT_BODY=$(echo "$DEACT_RESPONSE" | sed '$d')
  DEACT_STATUS=$(echo "$DEACT_RESPONSE" | tail -1)

  check_rate_limit "$DEACT_STATUS" "/api/licence/deactivate"
  assert_equals "200" "$DEACT_STATUS" "Device deactivation returns 200"
  
  # Stage 6A: Check for ok boolean
  DEACT_OK=$(echo "$DEACT_BODY" | jq -r '.ok // "missing"')
  TESTS_RUN=$((TESTS_RUN + 1))
  if [ "$DEACT_OK" = "true" ]; then
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Device deactivation response has ok: true"
  else
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "Device deactivation response missing ok: true (got: $DEACT_OK)"
  fi
fi

########################################
# Cleanup (optional)
########################################
do_cleanup() {
  log_section "Cleanup"
  
  # Note: We don't delete the test customer or entitlements - those are seeded data.
  # We only deactivate the device from all entitlements and optionally remove the device.
  
  if [ -n "${DEVICE_DB_ID:-}" ]; then
    log_info "Device already deactivated in test. Cleanup complete."
  else
    log_info "No device DB ID captured - nothing to cleanup"
  fi
}

if [ "$DO_CLEANUP" = "1" ]; then
  do_cleanup
fi

########################################
# Summary
########################################
print_summary

if [ "$TESTS_FAILED" -gt 0 ]; then
  exit 1
fi

exit 0
