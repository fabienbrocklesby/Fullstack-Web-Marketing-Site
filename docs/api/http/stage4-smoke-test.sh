#!/bin/bash
# Stage 4: Device-Based Activation API - Smoke Test
# Usage: cd docs/api/http && ./stage4-smoke-test.sh
#
# Prerequisites:
#   1. Backend running at http://127.0.0.1:1337
#   2. Copy .env.example to .env and fill in:
#      - CUSTOMER_EMAIL/PASSWORD (test account)
#      - ENTITLEMENT_ID (from /api/customers/me/entitlements)
#   3. chmod +x stage4-smoke-test.sh

set -e

# Load environment
if [ -f .env ]; then
    set -a
    source .env
    set +a
else
    echo "ERROR: .env file not found. Copy .env.example to .env and fill in values."
    exit 1
fi

BASE_URL="${API_BASE:-http://127.0.0.1:1337}"

echo "=========================================="
echo "Stage 4: Device Activation Smoke Test"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Email: $CUSTOMER_EMAIL"
echo ""

# Step 0: Login
echo "=== Step 0: Login ==="
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/customers/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CUSTOMER_EMAIL\",\"password\":\"$CUSTOMER_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')
if [ -z "$TOKEN" ]; then
    echo "ERROR: Login failed"
    echo "$LOGIN_RESPONSE" | jq .
    exit 1
fi
echo "✅ Logged in successfully"
echo ""

# Get entitlements
echo "=== Getting entitlements ==="
ENTITLEMENTS=$(curl -s "$BASE_URL/api/customers/me/entitlements" \
  -H "Authorization: Bearer $TOKEN")
echo "$ENTITLEMENTS" | jq '.entitlements[] | {id, tier, maxDevices, status}'

# Use ENTITLEMENT_ID from env or prompt
if [ -z "$ENTITLEMENT_ID" ]; then
    echo ""
    echo "Set ENTITLEMENT_ID in .env and re-run."
    exit 1
fi
echo ""
echo "Using ENTITLEMENT_ID=$ENTITLEMENT_ID"
echo ""

# Use device IDs from env
DEVICE_A="${DEVICE_ID_A:-smoke_test_device_a_$(date +%s)}"
DEVICE_B="${DEVICE_ID_B:-smoke_test_device_b_$(date +%s)}"
PK_A="${PUBLIC_KEY_A:-pk_smoke_test_aaaaaaaaaaaaaaaaaaaaaaa}"
PK_B="${PUBLIC_KEY_B:-pk_smoke_test_bbbbbbbbbbbbbbbbbbbbbbb}"

echo "Device A: $DEVICE_A"
echo "Device B: $DEVICE_B"
echo ""

# Test helper function
test_endpoint() {
    local step="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_http="$5"
    local description="$6"
    
    echo "=== Step $step: $description ==="
    
    RESPONSE=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$data")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -1)
    BODY=$(echo "$RESPONSE" | sed '$d')
    
    if [ "$HTTP_CODE" = "$expected_http" ]; then
        echo "✅ HTTP $HTTP_CODE (expected $expected_http)"
    else
        echo "❌ HTTP $HTTP_CODE (expected $expected_http)"
    fi
    echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
    echo ""
}

# Run tests
test_endpoint "1" "POST" "/api/device/register" \
    "{\"deviceId\":\"$DEVICE_A\",\"publicKey\":\"$PK_A\"}" \
    "200" "Register device A"

test_endpoint "2" "POST" "/api/licence/activate" \
    "{\"entitlementId\":$ENTITLEMENT_ID,\"deviceId\":\"$DEVICE_A\"}" \
    "200" "Activate entitlement on device A"

test_endpoint "3" "POST" "/api/device/register" \
    "{\"deviceId\":\"$DEVICE_B\",\"publicKey\":\"$PK_B\"}" \
    "200" "Register device B"

test_endpoint "4" "POST" "/api/licence/activate" \
    "{\"entitlementId\":$ENTITLEMENT_ID,\"deviceId\":\"$DEVICE_B\"}" \
    "409" "Activate same entitlement on device B (should fail - maxDevices=1)"

test_endpoint "5" "POST" "/api/licence/refresh" \
    "{\"entitlementId\":$ENTITLEMENT_ID,\"deviceId\":\"$DEVICE_A\"}" \
    "200" "Refresh on device A"

test_endpoint "6" "POST" "/api/licence/deactivate" \
    "{\"entitlementId\":$ENTITLEMENT_ID,\"deviceId\":\"$DEVICE_A\"}" \
    "200" "Deactivate device A"

test_endpoint "7" "POST" "/api/licence/activate" \
    "{\"entitlementId\":$ENTITLEMENT_ID,\"deviceId\":\"$DEVICE_B\"}" \
    "200" "Activate on device B (should now succeed)"

echo "=========================================="
echo "Stage 4 Smoke Test Complete"
echo "=========================================="
echo ""
echo "To clean up, deactivate device B:"
echo "curl -X POST \"$BASE_URL/api/licence/deactivate\" \\"
echo "  -H \"Authorization: Bearer \$TOKEN\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"entitlementId\":$ENTITLEMENT_ID,\"deviceId\":\"$DEVICE_B\"}'"
