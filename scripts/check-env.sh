#!/usr/bin/env bash
# Environment variable validation script
# Checks that required environment variables are defined (NAMES ONLY - never prints values)
# Exit code 0 = all required vars present
# Exit code 1 = one or more required vars missing

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Required environment variables for production deployment
# These are the NAMES of variables that must be set - we NEVER print their values
REQUIRED_PRODUCTION_VARS=(
    "DATABASE_HOST"
    "DATABASE_PORT"
    "DATABASE_NAME"
    "DATABASE_USER"
    "DATABASE_PASSWORD"
    "APP_KEYS"
    "API_TOKEN_SALT"
    "ADMIN_JWT_SECRET"
    "TRANSFER_TOKEN_SALT"
    "JWT_SECRET"
)

# Optional but recommended vars (warn if missing)
RECOMMENDED_VARS=(
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "JWT_PRIVATE_KEY"
    "SITE_URL"
)

# Development-safe defaults allowed vars (don't fail if these have dev defaults)
DEV_SAFE_VARS=(
    "DB_USER"
    "DB_PASSWORD"
    "DB_NAME"
)

missing_vars=()
warned_vars=()

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Environment Variable Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check NODE_ENV to determine strictness
NODE_ENV="${NODE_ENV:-development}"
echo -e "Mode: ${YELLOW}${NODE_ENV}${NC}"
echo ""

# In development mode, we're more lenient
if [[ "$NODE_ENV" == "production" ]]; then
    echo "Checking required production variables..."
    for var in "${REQUIRED_PRODUCTION_VARS[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
            echo -e "  ${RED}✗${NC} $var - MISSING"
        else
            echo -e "  ${GREEN}✓${NC} $var - set"
        fi
    done
else
    echo "Checking development variables (lenient mode)..."
    for var in "${DEV_SAFE_VARS[@]}"; do
        if [[ -z "${!var}" ]]; then
            echo -e "  ${YELLOW}○${NC} $var - not set (will use default)"
        else
            echo -e "  ${GREEN}✓${NC} $var - set"
        fi
    done
fi

echo ""
echo "Checking recommended variables..."
for var in "${RECOMMENDED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        warned_vars+=("$var")
        echo -e "  ${YELLOW}○${NC} $var - not set (recommended)"
    else
        echo -e "  ${GREEN}✓${NC} $var - set"
    fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Report results
if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo -e "${RED}ERROR: Missing required environment variables:${NC}"
    for var in "${missing_vars[@]}"; do
        echo -e "  - $var"
    done
    echo ""
    echo "Please set these variables before deploying to production."
    exit 1
fi

if [[ ${#warned_vars[@]} -gt 0 && "$NODE_ENV" == "production" ]]; then
    echo -e "${YELLOW}WARNING: Recommended variables not set:${NC}"
    for var in "${warned_vars[@]}"; do
        echo -e "  - $var"
    done
    echo ""
fi

echo -e "${GREEN}✓ Environment validation passed${NC}"
exit 0
