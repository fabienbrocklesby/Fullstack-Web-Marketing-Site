#!/bin/bash
set -e

BASE_URL="http://localhost:1337"

echo "=== Step 1: Login ==="
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/customers/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoketest@example.com","password":"SmokeTest123!"}')
echo "$LOGIN_RESPONSE" | jq -r '.token' > /tmp/customer_token.txt
CUSTOMER_TOKEN=$(cat /tmp/customer_token.txt)
echo "Customer token: ${CUSTOMER_TOKEN:0:20}..."

echo ""
echo "=== Step 2: Mint AI Token ==="
AI_TOKEN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/ai/token" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
echo "$AI_TOKEN_RESPONSE" | jq -r '.data.token' > /tmp/ai_token.txt
AI_TOKEN=$(cat /tmp/ai_token.txt)
echo "AI token: ${AI_TOKEN:0:20}..."

echo ""
echo "=== Step 3: Download test image ==="
curl -s -o /tmp/test-engrave.png "https://symbolsdb.com/assets/images/small-smiley-face-symbol.png"
ls -lh /tmp/test-engrave.png

echo ""
echo "=== Step 4: Call Engrave Assistant ==="

PAYLOAD_JSON='{"prompt":"Make the engraving crisp with clean edges.","context":{"material":"birch plywood","device":"LightLane Pro","currentSettings":{"power":45,"speed":220}},"availableSettings":{"power":{"type":"number","minimum":0,"maximum":100},"speed":{"type":"number","minimum":1,"maximum":300},"passes":{"type":"integer","minimum":1,"maximum":10},"dither":{"type":"boolean"},"mode":{"type":"string","enum":["raster","vector"]}}}'

curl -v -X POST "${BASE_URL}/api/v1/ai/engrave-assistant" \
  -H "Authorization: Bearer $AI_TOKEN" \
  -F "image=@/tmp/test-engrave.png;type=image/png" \
  -F "payload=$PAYLOAD_JSON"

echo ""
echo "=== Done ==="
