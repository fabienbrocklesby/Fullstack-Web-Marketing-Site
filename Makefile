# Must-pass checks for CI/CD pipeline
# All checks run inside Docker containers - no host installs required

COMPOSE_FILE := docker-compose.dev.yml
DOCKER_COMPOSE := docker compose -f $(COMPOSE_FILE)

.PHONY: check check-env check-lint check-build clean help

# Default target
help:
	@echo "Available targets:"
	@echo "  make check      - Run all must-pass checks (env, lint, build)"
	@echo "  make check-env  - Validate required environment variables"
	@echo "  make check-lint - Run linting in Docker containers"
	@echo "  make check-build - Run build in Docker containers"
	@echo "  make clean      - Stop and remove containers"

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

# Clean up containers
clean:
	@echo "🧹 Cleaning up containers..."
	@$(DOCKER_COMPOSE) down --remove-orphans -v 2>/dev/null || true
	@echo "✅ Cleanup complete"
