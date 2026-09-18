#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="${PALTA_SIMULATOR_BRANCH:-integration/simulator-runtime-fix-v1}"
MOCK_PORT="${PALTA_MOCK_PORT:-8787}"

fail() {
  echo "FAIL: $1" >&2
  exit "${2:-1}"
}

info() {
  echo "[Palta Simulator] $1"
}

[ "$(uname -s)" = "Darwin" ] || fail "This launcher must run on macOS."

for cmd in git node npm xcrun xcodebuild open lsof; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

NODE_MAJOR="$(node -e "process.stdout.write(process.versions.node.split('.')[0])")"
[ "$NODE_MAJOR" -ge 22 ] || fail "Node 22+ required; found $(node -v)."

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || fail "Run this from inside the Palta git repository."
cd "$ROOT"

APP_DIR="$ROOT/apps/mobile"
[ -f "$APP_DIR/package.json" ] || fail "Existing Expo app not found at $APP_DIR. Nothing was created or overwritten."

info "Using existing mobile app: $APP_DIR"
info "Fetching simulator recovery branch without switching your current branch..."
git fetch origin "$TARGET_BRANCH" >/dev/null
REF="origin/$TARGET_BRANCH"
git rev-parse --verify "$REF" >/dev/null 2>&1 || fail "Cannot resolve $REF after fetch."

SOURCE_PATH="mobile-overlay/src/hooks/useAsyncResource.ts"
DEST_PATH="$APP_DIR/src/hooks/useAsyncResource.ts"
git cat-file -e "$REF:$SOURCE_PATH" 2>/dev/null || fail "Recovery source missing: $SOURCE_PATH"

mkdir -p "$(dirname "$DEST_PATH")"
TMP_SOURCE="$(mktemp /tmp/palta-useAsyncResource.XXXXXX)"
trap 'rm -f "$TMP_SOURCE"' EXIT
git show "$REF:$SOURCE_PATH" > "$TMP_SOURCE"

if [ -f "$DEST_PATH" ] && ! cmp -s "$TMP_SOURCE" "$DEST_PATH"; then
  BACKUP_DIR="/tmp/palta-simulator-backup-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$BACKUP_DIR"
  cp "$DEST_PATH" "$BACKUP_DIR/useAsyncResource.ts"
  info "Backed up previous hook to $BACKUP_DIR/useAsyncResource.ts"
fi

if [ ! -f "$DEST_PATH" ] || ! cmp -s "$TMP_SOURCE" "$DEST_PATH"; then
  cp "$TMP_SOURCE" "$DEST_PATH"
  info "Applied verified async-resource loop fix to local Expo app."
else
  info "Async-resource fix is already present."
fi

# Simulator recovery always uses the local development API for this launch.
# These exports are process-local; no .env file is overwritten.
export EXPO_PUBLIC_PALTA_API_BASE_URL="http://127.0.0.1:${MOCK_PORT}"
export EXPO_PUBLIC_ENV="development"

if lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  info "Port $MOCK_PORT already has a listener; reusing it for smoke verification."
else
  info "Starting Palta development mock API on port $MOCK_PORT..."
  PALTA_MOCK_PORT="$MOCK_PORT" nohup node "$ROOT/dev/mock-api/server.mjs" >/tmp/palta-mock-api.log 2>&1 &
  echo $! >/tmp/palta-mock-api.pid
  sleep 1
fi

if ! node "$ROOT/dev/mock-api/smoke.mjs"; then
  echo "--- mock API log ---" >&2
  tail -80 /tmp/palta-mock-api.log 2>/dev/null || true
  fail "Mock API smoke test failed."
fi
info "Mock API smoke test passed."

open -a Simulator

BOOTED_UDID="$(xcrun simctl list devices booted | awk -F '[()]' '/iPhone/ && /Booted/ {print $2; exit}')"
if [ -n "$BOOTED_UDID" ]; then
  UDID="$BOOTED_UDID"
  info "Reusing booted iPhone Simulator: $UDID"
else
  DEVICE_LINE="$(xcrun simctl list devices available | awk '/iPhone 18 Pro/ {print; exit}')"
  if [ -z "$DEVICE_LINE" ]; then
    DEVICE_LINE="$(xcrun simctl list devices available | awk '/iPhone/ {print; exit}')"
  fi
  [ -n "$DEVICE_LINE" ] || fail "No available iPhone Simulator device found in Xcode."

  UDID="$(printf '%s\n' "$DEVICE_LINE" | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/')"
  [ -n "$UDID" ] && [ "$UDID" != "$DEVICE_LINE" ] || fail "Could not parse Simulator UDID from: $DEVICE_LINE"

  info "Booting iPhone Simulator: $DEVICE_LINE"
  xcrun simctl boot "$UDID" 2>/dev/null || true
fi

xcrun simctl bootstatus "$UDID" -b

cd "$APP_DIR"
if [ ! -d node_modules ]; then
  info "Mobile dependencies are missing; installing them once..."
  npm install
fi

info "Building, installing, and launching Palta on iOS Simulator..."
info "Target UDID: $UDID"
npx expo run:ios --device "$UDID"
