#!/usr/bin/env bash
# ==============================================================================
# use-local-env.sh - Load environment variables for API tests
# ==============================================================================
# This script can be sourced from anywhere in the repo. It finds the .env file
# relative to its own location (docs/api/http/.env).
#
# Usage (from any directory):
#   source docs/api/http/use-local-env.sh
#
# Variables loaded:
#   API_BASE              - Backend URL (e.g., http://127.0.0.1:1337)
#   CMS_URL               - Alias for API_BASE (backwards compatibility)
#   TEST_CUSTOMER_EMAIL   - Smoke test customer email
#   TEST_CUSTOMER_PASSWORD - Smoke test customer password
#   CUSTOMER_EMAIL        - Your manual testing email (optional)
#   CUSTOMER_PASSWORD     - Your manual testing password (optional)
#   CUSTOMER_TOKEN        - Pre-fetched JWT (optional)
#   ENTITLEMENT_ID        - Pre-fetched entitlement ID (optional)
#   DEVICE_ID_A/B         - Test device IDs
#   PUBLIC_KEY_A/B        - Test public keys
#
# IMPORTANT: This script only LOADS variables. It never writes to .env.
# ==============================================================================

# Determine the directory where this script lives
_USE_LOCAL_ENV_DIR=""
if [[ -n "${BASH_SOURCE[0]}" ]]; then
    _USE_LOCAL_ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
elif [[ -n "$0" ]]; then
    _USE_LOCAL_ENV_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

# Fallback: try common locations
if [[ -z "$_USE_LOCAL_ENV_DIR" ]] || [[ ! -f "$_USE_LOCAL_ENV_DIR/.env" ]]; then
    if [[ -f "docs/api/http/.env" ]]; then
        _USE_LOCAL_ENV_DIR="$(pwd)/docs/api/http"
    elif [[ -f "../docs/api/http/.env" ]]; then
        _USE_LOCAL_ENV_DIR="$(cd ../docs/api/http && pwd)"
    fi
fi

_ENV_FILE="$_USE_LOCAL_ENV_DIR/.env"

if [[ ! -f "$_ENV_FILE" ]]; then
    echo "ERROR: .env file not found at $_ENV_FILE"
    echo ""
    echo "To fix:"
    echo "  1. cd docs/api/http"
    echo "  2. cp .env.example .env"
    echo "  3. Run: make seed-test-customer"
    echo ""
    if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
        exit 1
    else
        return 1
    fi
fi

# Export all variables from .env
set -a
source "$_ENV_FILE"
set +a

# Set CMS_URL as alias for API_BASE (backwards compatibility)
export CMS_URL="${CMS_URL:-$API_BASE}"
export API_BASE="${API_BASE:-$CMS_URL}"

# Only show minimal output (smoke tests handle their own output)
if [[ "${VERBOSE:-}" == "1" ]]; then
    echo "✓ Loaded env from: $_ENV_FILE"
    echo "  API_BASE=$API_BASE"
fi

# Cleanup temp vars
unset _USE_LOCAL_ENV_DIR _ENV_FILE