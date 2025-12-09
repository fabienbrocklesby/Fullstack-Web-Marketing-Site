#!/bin/sh
set -e

# Ensure pnpm is available in PATH
export PNPM_HOME=${PNPM_HOME:-/root/.local/share/pnpm}
export PATH="$PNPM_HOME:$PATH"
export CI=${CI:-true}

cd /workspace

# Always reinstall dependencies in dev mode to ensure correct native binaries
echo "Installing backend dependencies..."
pnpm install --filter backend... --no-frozen-lockfile --force

# Optional: ensure frontend dependencies exist for shared workspace (prevents pnpm errors)
cd /workspace/backend

export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-1337}
export CHOKIDAR_USEPOLLING=${CHOKIDAR_USEPOLLING:-true}
export STRAPI_LOG_LEVEL=${STRAPI_LOG_LEVEL:-debug}

echo "Starting Strapi in develop mode..."
exec pnpm dev
