#!/usr/bin/env bash
# Seed smoke test data (customer + entitlements + device)
# Wrapper script that calls the backend Node.js seeder
#
# Usage: ./seed-test-customer.sh
#
# This is idempotent - safe to run multiple times.
# Creates or reuses:
#   - Test customer: smoketest@example.com
#   - Subscription entitlement (maxDevices=1, 1 year validity)
#   - Lifetime entitlement (maxDevices=3, no expiry)
#   - Test device: smoke-test-device-001

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Check if backend container is running
if ! docker compose -f "$REPO_ROOT/docker-compose.dev.yml" ps backend 2>/dev/null | grep -q "Up"; then
  echo "ERROR: Backend container is not running."
  echo "Start it with: make up"
  exit 1
fi

# Run seed script in backend container
docker compose -f "$REPO_ROOT/docker-compose.dev.yml" exec -T backend \
  node scripts/seed-smoke-test-data.js

# Update .env file with test credentials
ENV_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$SCRIPT_DIR/.env.example" ]; then
    cp "$SCRIPT_DIR/.env.example" "$ENV_FILE"
    echo "Created $ENV_FILE from .env.example"
  else
    cat > "$ENV_FILE" << 'EOF'
# API endpoint
API_URL=http://127.0.0.1:1337

# Test customer (for smoke tests)
TEST_CUSTOMER_EMAIL=smoketest@example.com
TEST_CUSTOMER_PASSWORD=SmokeTest123!

# Test device
TEST_DEVICE_ID=smoke-test-device-001

# For REST Client (optional - copy JWT here after login)
JWT=
EOF
    echo "Created $ENV_FILE with defaults"
  fi
fi

# Ensure test credentials are in .env
if ! grep -q "TEST_CUSTOMER_EMAIL" "$ENV_FILE"; then
  echo "" >> "$ENV_FILE"
  echo "TEST_CUSTOMER_EMAIL=smoketest@example.com" >> "$ENV_FILE"
  echo "TEST_CUSTOMER_PASSWORD=SmokeTest123!" >> "$ENV_FILE"
fi

echo ""
echo "✅ Smoke test data seeded successfully"
echo ""
echo "To run smoke tests:"
echo "  make smoke-stage5"
echo "  make smoke-stage4"
echo ""
echo "Or source the env and run directly:"
echo "  source docs/api/http/.env"
echo "  ./docs/api/http/stage5/smoke-test.sh"
