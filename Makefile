# Must-pass checks for CI/CD pipeline
# All checks run inside Docker containers - no host installs required

COMPOSE_FILE := docker-compose.dev.yml
DOCKER_COMPOSE := docker compose -f $(COMPOSE_FILE)

.PHONY: help dev dev-build up down logs restart deps deps-force deps-watch check check-env check-lint check-build clean

# Default target
help:
	@echo "Available targets:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start the full stack (fast if deps unchanged)"
	@echo "  make dev-build    - Rebuild images then start (use after Dockerfile changes)"
	@echo "  make up           - Alias for make dev"
	@echo "  make down         - Stop all containers (preserves volumes)"
	@echo "  make logs         - Follow logs from all containers"
	@echo "  make restart      - Restart containers (no image rebuild)"
	@echo ""
	@echo "Dependencies:"
	@echo "  make deps         - Force reinstall dependencies on next restart"
	@echo "  make deps-watch   - Force reinstall and follow logs"
	@echo ""
	@echo "Smoke Tests:"
	@echo "  make seed-test-customer - Create test customer + entitlements (idempotent)"
	@echo "  make smoke        - Run all smoke tests"
	@echo "  make smoke-stage4 - Run Stage 4 device activation test"
	@echo "  make smoke-stage5 - Run Stage 5.5 full licensing test"
	@echo ""
	@echo "Checks (CI/CD):"
	@echo "  make check        - Run all must-pass checks (env, lint, build)"
	@echo "  make check-env    - Validate required environment variables"
	@echo "  make check-lint   - Run linting in Docker containers"
	@echo "  make check-build  - Run build in Docker containers"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean        - Stop and remove containers + volumes (DESTRUCTIVE)"

# ============================================================
# Development targets
# ============================================================

# Start the full stack in development mode (no rebuild by default)
dev:
	@echo "🚀 Starting development stack..."
	@$(DOCKER_COMPOSE) up -d
	@echo ""
	@echo "✅ Stack started. Services:"
	@echo "   - Backend (Strapi):  http://localhost:1337"
	@echo "   - Frontend (Astro):  http://localhost:4321"
	@echo ""
	@echo "Run 'make logs' to follow logs, 'make down' to stop."

# Rebuild images then start (use after Dockerfile changes)
dev-build:
	@echo "🔨 Rebuilding images and starting development stack..."
	@$(DOCKER_COMPOSE) up -d --build
	@echo ""
	@echo "✅ Stack started with fresh images."

# Alias for dev
up: dev

# Stop all containers (preserves volumes)
down:
	@echo "🛑 Stopping development stack..."
	@$(DOCKER_COMPOSE) down

# Follow logs from all containers
logs:
	@$(DOCKER_COMPOSE) logs -f

# Restart all containers (no image rebuild, fast)
restart:
	@echo "🔄 Restarting containers..."
	@$(DOCKER_COMPOSE) restart backend frontend
	@echo "✅ Containers restarted."

# ============================================================
# Dependency management targets
# ============================================================

# Force reinstall all dependencies (removes sentinel file)
deps:
	@echo "📦 Forcing dependency reinstall..."
	@$(DOCKER_COMPOSE) exec backend rm -f /workspace/node_modules/.installed.lockhash 2>/dev/null || true
	@$(DOCKER_COMPOSE) restart backend frontend
	@echo "✅ Dependencies will reinstall on container restart."

# Alias for deps
deps-force: deps

# Force reinstall and follow logs
deps-watch:
	@echo "📦 Forcing dependency reinstall and following logs..."
	@$(DOCKER_COMPOSE) exec backend rm -f /workspace/node_modules/.installed.lockhash 2>/dev/null || true
	@$(DOCKER_COMPOSE) restart backend frontend
	@$(DOCKER_COMPOSE) logs -f backend frontend

# ============================================================
# Migration scripts
# ============================================================

# Run entitlement backfill migration (dry-run)
migrate-entitlements-dry:
	@echo "🔍 Running entitlement backfill migration (DRY RUN)..."
	@$(DOCKER_COMPOSE) exec backend sh -c "cd /workspace/backend && node scripts/backfill-entitlements.js --dry-run"

# Run entitlement backfill migration (apply)
migrate-entitlements:
	@echo "🚀 Running entitlement backfill migration (APPLY)..."
	@$(DOCKER_COMPOSE) exec backend sh -c "cd /workspace/backend && node scripts/backfill-entitlements.js --apply"

# Run entitlement backfill migration with verbose output
migrate-entitlements-verbose:
	@echo "🔍 Running entitlement backfill migration (DRY RUN, VERBOSE)..."
	@$(DOCKER_COMPOSE) exec backend sh -c "cd /workspace/backend && node scripts/backfill-entitlements.js --dry-run --verbose"

# Fix bad "founders" tier entitlements (dry-run)
migrate-entitlements-fix-dry:
	@echo "🔍 Running founders tier fix (DRY RUN)..."
	@$(DOCKER_COMPOSE) exec backend sh -c "cd /workspace/backend && node scripts/fix-founders-tier.js --dry-run --verbose"

# Fix bad "founders" tier entitlements (apply)
migrate-entitlements-fix:
	@echo "🚀 Running founders tier fix (APPLY)..."
	@$(DOCKER_COMPOSE) exec backend sh -c "cd /workspace/backend && node scripts/fix-founders-tier.js --apply --verbose"

# ============================================================
# Sanity tests
# ============================================================

# Run all Stage 2 sanity tests
sanity-stage2:
	@echo "🧪 Running Stage 2 sanity tests..."
	@$(DOCKER_COMPOSE) exec -T backend sh -c "cd /workspace/backend && node scripts/sanity-stage2.js --test=all"

# Run specific sanity test (relations, activation, endpoint)
sanity-stage2-relations:
	@$(DOCKER_COMPOSE) exec -T backend sh -c "cd /workspace/backend && node scripts/sanity-stage2.js --test=relations"

sanity-stage2-activation:
	@$(DOCKER_COMPOSE) exec -T backend sh -c "cd /workspace/backend && node scripts/sanity-stage2.js --test=activation"

sanity-stage2-endpoint:
	@$(DOCKER_COMPOSE) exec -T backend sh -c "cd /workspace/backend && node scripts/sanity-stage2.js --test=endpoint"

# Cleanup sanity test data
sanity-stage2-cleanup:
	@$(DOCKER_COMPOSE) exec -T backend sh -c "cd /workspace/backend && node scripts/sanity-stage2.js --cleanup"

# Run all Stage 3 sanity tests (Stripe webhook & subscriptions)
sanity-stage3:
	@echo "🧪 Running Stage 3 sanity tests..."
	@$(DOCKER_COMPOSE) exec -T backend sh -c "cd /workspace/backend && node scripts/sanity-stage3.js --test=all"

# Run specific Stage 3 sanity test
sanity-stage3-idempotency:
	@$(DOCKER_COMPOSE) exec -T backend sh -c "cd /workspace/backend && node scripts/sanity-stage3.js --test=idempotency"

sanity-stage3-webhook:
	@$(DOCKER_COMPOSE) exec -T backend sh -c "cd /workspace/backend && node scripts/sanity-stage3.js --test=webhook"

sanity-stage3-founders:
	@$(DOCKER_COMPOSE) exec -T backend sh -c "cd /workspace/backend && node scripts/sanity-stage3.js --test=founders"

sanity-stage3-polling:
	@$(DOCKER_COMPOSE) exec -T backend sh -c "cd /workspace/backend && node scripts/sanity-stage3.js --test=polling"

# Cleanup Stage 3 sanity test data
sanity-stage3-cleanup:
	@$(DOCKER_COMPOSE) exec -T backend sh -c "cd /workspace/backend && node scripts/sanity-stage3.js --cleanup"

# ============================================================
# Smoke tests (API integration tests)
# ============================================================

# Create test customer + entitlements for smoke tests (idempotent)
seed-test-customer:
	@echo "🌱 Seeding smoke test data..."
	@./docs/api/http/seed-test-customer.sh

# Run Stage 4 smoke test (device-based activation)
smoke-stage4:
	@echo "🧪 Running Stage 4 smoke test..."
	@./docs/api/http/stage4/smoke-test.sh

# Run Stage 5.5 smoke test (full licensing validation)
smoke-stage5:
	@echo "🧪 Running Stage 5.5 smoke test..."
	@./docs/api/http/stage5/smoke-test.sh

# Run all smoke tests (Stage 5.5 is the comprehensive one)
smoke: smoke-stage5
	@echo "✅ All smoke tests completed"

# ============================================================
# CI/CD check targets
# ============================================================

# Run all must-pass checks
check: check-env check-lint check-build
	@echo ""
	@echo "✅ All must-pass checks completed successfully!"

# Validate required environment variables (names only, never print values)
check-env:
	@echo "🔍 Checking required environment variables..."
	@./scripts/check-env.sh

# Run linting inside Docker
check-lint:
	@echo "🧹 Running lint checks in Docker..."
	@$(DOCKER_COMPOSE) build --quiet backend frontend
	@$(DOCKER_COMPOSE) run --rm --no-deps backend sh -c "cd /workspace && pnpm install --frozen-lockfile && cd backend && pnpm lint" || (echo "❌ Backend lint failed" && exit 1)
	@$(DOCKER_COMPOSE) run --rm --no-deps frontend sh -c "cd /workspace && pnpm install --frozen-lockfile && cd frontend && pnpm lint" || (echo "❌ Frontend lint failed" && exit 1)
	@echo "✅ Lint checks passed"

# Run build inside Docker
check-build:
	@echo "🔨 Running build checks in Docker..."
	@$(DOCKER_COMPOSE) build --quiet backend frontend
	@$(DOCKER_COMPOSE) run --rm --no-deps backend sh -c "cd /workspace && pnpm install --frozen-lockfile && cd backend && pnpm build" || (echo "❌ Backend build failed" && exit 1)
	@$(DOCKER_COMPOSE) run --rm --no-deps frontend sh -c "cd /workspace && pnpm install --frozen-lockfile && cd frontend && pnpm build" || (echo "❌ Frontend build failed" && exit 1)
	@echo "✅ Build checks passed"

# ============================================================
# Cleanup targets
# ============================================================

# Clean up containers and volumes
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	@$(DOCKER_COMPOSE) down --remove-orphans -v 2>/dev/null || true
	@echo "✅ Cleanup complete"

# ============================================================
# Air-Gapped Test Code Generation
# ============================================================

# Generate Device Setup Code interactively (creates persistent device identity)
# Usage: make airgap-setup
# This is the first step for testing air-gapped flows.
.PHONY: airgap-setup
airgap-setup:
	@cd backend && node scripts/generate-device-setup-code.js

# Generate Refresh/Deactivation codes from an Activation Package
# Extracts deviceId + entitlementId from the embedded lease token
# Usage: make airgap-request-codes
# Prerequisites: run `make airgap-setup` first, then provision in portal
