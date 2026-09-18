#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/repo-safety-check.sh"

ROOT="$(git rev-parse --show-toplevel)"
APP_DIR="$ROOT/apps/mobile"

if [ ! -f "$APP_DIR/package.json" ] || [ ! -f "$APP_DIR/package-lock.json" ]; then
  echo "FAIL: versioned Palta mobile runtime shell is missing at $APP_DIR." >&2
  echo "Refusing to create a second Expo app with create-expo-app@latest." >&2
  exit 20
fi

NODE_MAJOR="$(node -e "process.stdout.write(process.versions.node.split('.')[0])")"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "FAIL: Node 22+ required; found $(node -v)." >&2
  exit 21
fi

echo "[Palta Mobile] Materializing current branch overlay..."
node "$SCRIPT_DIR/sync-mobile-runtime.mjs"

echo "[Palta Mobile] Installing locked Expo SDK 57 dependencies..."
npm ci --prefix "$APP_DIR"

echo
printf '%s\n' \
  "PASS: Palta mobile runtime prepared." \
  "Source of Truth: mobile-overlay/src" \
  "Generated runtime: apps/mobile/src" \
  "Native shell: apps/mobile" \
  "MapLibre verification requires an iOS/Android development build."
