#!/bin/sh
set -e

export PNPM_HOME=${PNPM_HOME:-/root/.local/share/pnpm}
export PATH="$PNPM_HOME:$PATH"
export CI=${CI:-true}

cd /workspace

if [ ! -d /workspace/frontend/node_modules ] || [ -z "$(ls -A /workspace/frontend/node_modules 2>/dev/null)" ]; then
  echo "Installing frontend dependencies..."
  pnpm install --filter frontend... --no-frozen-lockfile
fi

cd /workspace/frontend

export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-4321}

echo "Starting Astro dev server..."
exec pnpm dev -- --host 0.0.0.0 --port ${PORT}
