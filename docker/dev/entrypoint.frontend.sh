#!/bin/sh
set -e

export PNPM_HOME=${PNPM_HOME:-/root/.local/share/pnpm}
export PATH="$PNPM_HOME:$PATH"
export CI=${CI:-true}

cd /workspace

# ------------------------------------------------------------
# Lockfile-hash sentinel: only install deps if they changed
# Stored in root node_modules since pnpm workspace hoists there
# ------------------------------------------------------------
SENTINEL_FILE="/workspace/node_modules/.installed.lockhash"
LOCK_FILES="/workspace/pnpm-lock.yaml /workspace/package.json /workspace/frontend/package.json /workspace/pnpm-workspace.yaml"

# Compute hash of lockfile + package.json files
compute_hash() {
  cat $LOCK_FILES 2>/dev/null | sha256sum | cut -d' ' -f1
}

CURRENT_HASH=$(compute_hash)
STORED_HASH=""

if [ -f "$SENTINEL_FILE" ]; then
  STORED_HASH=$(cat "$SENTINEL_FILE" 2>/dev/null || echo "")
fi

# Check if node_modules exists and has content
NODE_MODULES_EXISTS=$([ -d "/workspace/node_modules" ] && [ "$(ls -A /workspace/node_modules 2>/dev/null)" ] && echo "yes" || echo "no")

if [ "$NODE_MODULES_EXISTS" = "yes" ] && [ "$CURRENT_HASH" = "$STORED_HASH" ]; then
  echo "✓ Dependencies unchanged (hash match), skipping install"
else
  if [ "$NODE_MODULES_EXISTS" = "no" ]; then
    echo "→ node_modules empty or missing, installing dependencies..."
  else
    echo "→ Dependencies changed (hash mismatch), installing..."
  fi
  
  # Install all workspace dependencies (pnpm hoists shared deps to root)
  pnpm install --frozen-lockfile
  
  # Store the hash
  echo "$CURRENT_HASH" > "$SENTINEL_FILE"
  echo "✓ Dependencies installed and sentinel updated"
fi

# ------------------------------------------------------------
# Start Astro
# ------------------------------------------------------------
cd /workspace/frontend

export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-4321}

echo "Starting Astro dev server..."
exec pnpm dev -- --host 0.0.0.0 --port ${PORT}
