#!/usr/bin/env bash
# Stage 4: Device-Based Activation Smoke Test
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
# This script tests the Stage 4 device activation flow:
# - Device registration
# - Entitlement activation (auto-selects subscription entitlement)
# - Lease refresh
# - maxDevices enforcement
# - Device deactivation
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
# 2. Fetch Entitlements & Auto-Select
########################################
log_section "2. Fetch Entitlements"

ENT_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/api/customers/me/entitlements" \
  -H "Authorization: Bearer $JWT")

ENT_BODY=$(echo "$ENT_RESPONSE" | sed '$d')
ENT_STATUS=$(echo "$ENT_RESPONSE" | tail -1)

check_rate_limit "$ENT_STATUS" "/api/customers/me/entitlements"
assert_equals "200" "$ENT_STATUS" "Fetch entitlements returns 200"

ENT_COUNT=$(echo "$ENT_BODY" | jq '.entitlements | length')
log_info "Found $ENT_COUNT entitlements"

# Auto-select a subscription entitlement (isLifetime=false) for testing
# This is preferred because subscription entitlements have more testable behavior
SUBSCRIPTION_ENT=$(echo "$ENT_BODY" | jq -r '.entitlements[] | select(.isLifetime == false) | .id' | head -1)
LIFETIME_ENT=$(echo "$ENT_BODY" | jq -r '.entitlements[] | select(.isLifetime == true) | .id' | head -1)
MAX_DEVICES=$(echo "$ENT_BODY" | jq -r ".entitlements[] | select(.id == ${SUBSCRIPTION_ENT:-0}) | .maxDevices" 2>/dev/null || echo "1")

if [ -n "$SUBSCRIPTION_ENT" ]; then
  TEST_ENT="$SUBSCRIPTION_ENT"
  MAX_DEVICES=$(echo "$ENT_BODY" | jq -r ".entitlements[] | select(.id == $SUBSCRIPTION_ENT) | .maxDevices")
  log_info "Auto-selected subscription entitlement (ID: $TEST_ENT, maxDevices: $MAX_DEVICES)"
elif [ -n "$LIFETIME_ENT" ]; then
  TEST_ENT="$LIFETIME_ENT"
  MAX_DEVICES=$(echo "$ENT_BODY" | jq -r ".entitlements[] | select(.id == $LIFETIME_ENT) | .maxDevices")
  log_info "Auto-selected lifetime entitlement (ID: $TEST_ENT, maxDevices: $MAX_DEVICES)"
else
  log_fail "No entitlements found for test customer"
  exit 3
fi

########################################
# 3. Device Registration (Device A)
########################################
log_section "3. Device Registration (Device A)"

DEVICE_A="${TEST_DEVICE_ID}"
PUBLIC_KEY_A="smoke-test-public-key-a-$(date +%s)"

REG_A_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/device/register" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\": \"$DEVICE_A\", \"publicKey\": \"$PUBLIC_KEY_A\", \"platform\": \"macos\", \"deviceName\": \"Smoke Test Device A\"}")

REG_A_BODY=$(echo "$REG_A_RESPONSE" | sed '$d')
REG_A_STATUS=$(echo "$REG_A_RESPONSE" | tail -1)

check_rate_limit "$REG_A_STATUS" "/api/device/register"
assert_equals "200" "$REG_A_STATUS" "Device A registration returns 200"

log_info "Device A registered: $DEVICE_A"

########################################
# 4. License Activation (Device A)
########################################
log_section "4. License Activation (Device A)"

ACT_A_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/licence/activate" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\": \"$DEVICE_A\", \"entitlementId\": $TEST_ENT}")

ACT_A_BODY=$(echo "$ACT_A_RESPONSE" | sed '$d')
ACT_A_STATUS=$(echo "$ACT_A_RESPONSE" | tail -1)

check_rate_limit "$ACT_A_STATUS" "/api/licence/activate"
assert_equals "200" "$ACT_A_STATUS" "License activation (Device A) returns 200"

# Activation returns ok/message/entitlement/device (lease token comes from refresh)
DEVICE_BOUND=$(echo "$ACT_A_BODY" | jq -r '.device.boundAt // empty')
assert_not_empty "$DEVICE_BOUND" "Device A binding confirmed"

########################################
# 5. Lease Refresh (Device A)
########################################
log_section "5. Lease Refresh (Device A)"

REFRESH_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/licence/refresh" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\": \"$DEVICE_A\", \"entitlementId\": $TEST_ENT}")

REFRESH_BODY=$(echo "$REFRESH_RESPONSE" | sed '$d')
REFRESH_STATUS=$(echo "$REFRESH_RESPONSE" | tail -1)

check_rate_limit "$REFRESH_STATUS" "/api/licence/refresh"
assert_equals "200" "$REFRESH_STATUS" "Lease refresh (Device A) returns 200"

########################################
# 6. maxDevices Enforcement (Device B)
########################################
log_section "6. maxDevices Enforcement Test"

if [ "${MAX_DEVICES:-1}" = "1" ]; then
  DEVICE_B="smoke-test-device-b-$(date +%s)"
  PUBLIC_KEY_B="smoke-test-public-key-b-$(date +%s)"

  # Register Device B
  REG_B_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/device/register" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"deviceId\": \"$DEVICE_B\", \"publicKey\": \"$PUBLIC_KEY_B\", \"platform\": \"macos\", \"deviceName\": \"Smoke Test Device B\"}")

  REG_B_STATUS=$(echo "$REG_B_RESPONSE" | tail -1)
  check_rate_limit "$REG_B_STATUS" "/api/device/register"
  
  log_info "Device B registered: $DEVICE_B"

  # Try to activate on Device B (should fail - maxDevices=1)
  ACT_B_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/licence/activate" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"deviceId\": \"$DEVICE_B\", \"entitlementId\": $TEST_ENT}")

  ACT_B_BODY=$(echo "$ACT_B_RESPONSE" | sed '$d')
  ACT_B_STATUS=$(echo "$ACT_B_RESPONSE" | tail -1)

  check_rate_limit "$ACT_B_STATUS" "/api/licence/activate"
  
  # Expect 409 Conflict or 400 Bad Request (max devices reached)
  if [ "$ACT_B_STATUS" = "409" ] || [ "$ACT_B_STATUS" = "400" ]; then
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    log_pass "Device B activation blocked (maxDevices=1, status: $ACT_B_STATUS)"
  else
    TESTS_RUN=$((TESTS_RUN + 1))
    TESTS_FAILED=$((TESTS_FAILED + 1))
    log_fail "Device B activation should be blocked (expected 409/400, got: $ACT_B_STATUS)"
  fi
else
  log_info "Skipping maxDevices test (maxDevices=$MAX_DEVICES, need maxDevices=1)"
fi

########################################
# 7. Device Deactivation (Device A)
########################################
log_section "7. Device Deactivation (Device A)"

DEACT_A_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/licence/deactivate" \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d "{\"deviceId\": \"$DEVICE_A\", \"entitlementId\": $TEST_ENT}")

DEACT_A_BODY=$(echo "$DEACT_A_RESPONSE" | sed '$d')
DEACT_A_STATUS=$(echo "$DEACT_A_RESPONSE" | tail -1)

check_rate_limit "$DEACT_A_STATUS" "/api/licence/deactivate"
assert_equals "200" "$DEACT_A_STATUS" "Device A deactivation returns 200"

########################################
# 8. Device Transfer (Device B can now activate)
########################################
log_section "8. Device Transfer Test"

if [ -n "${DEVICE_B:-}" ]; then
  ACT_B2_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/licence/activate" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"deviceId\": \"$DEVICE_B\", \"entitlementId\": $TEST_ENT}")

  ACT_B2_BODY=$(echo "$ACT_B2_RESPONSE" | sed '$d')
  ACT_B2_STATUS=$(echo "$ACT_B2_RESPONSE" | tail -1)

  check_rate_limit "$ACT_B2_STATUS" "/api/licence/activate"
  assert_equals "200" "$ACT_B2_STATUS" "Device B activation succeeds after Device A deactivated"

  # Deactivate Device B for cleanup
  DEACT_B_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/licence/deactivate" \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "{\"deviceId\": \"$DEVICE_B\", \"entitlementId\": $TEST_ENT}")

  DEACT_B_STATUS=$(echo "$DEACT_B_RESPONSE" | tail -1)
  check_rate_limit "$DEACT_B_STATUS" "/api/licence/deactivate"
  log_info "Device B deactivated for cleanup"
else
  log_info "Skipping device transfer test (no Device B)"
fi

########################################
# Cleanup (optional)
########################################
do_cleanup() {
  log_section "Cleanup"
  log_info "Test devices deactivated during tests. Cleanup complete."
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
