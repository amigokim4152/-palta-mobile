#!/usr/bin/env bash
set -euo pipefail

MOCK_PORT="${PALTA_MOCK_PORT:-8787}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel)"
APP_DIR="$ROOT/apps/mobile"

fail() {
  echo "FAIL: $1" >&2
  exit "${2:-1}"
}

info() {
  echo "[Palta iOS] $1"
}

[ "$(uname -s)" = "Darwin" ] || fail "iOS Simulator launch requires macOS."
for cmd in git node npm xcrun xcode-select open lsof; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

[ -f "$APP_DIR/package.json" ] || fail "Versioned mobile shell missing at $APP_DIR."

NODE_MAJOR="$(node -e "process.stdout.write(process.versions.node.split('.')[0])")"
[ "$NODE_MAJOR" -ge 22 ] || fail "Node 22+ required; found $(node -v)."

cd "$ROOT"
info "Materializing the current branch mobile overlay..."
node scripts/sync-mobile-runtime.mjs

if [ ! -d "$APP_DIR/node_modules" ]; then
  info "Installing locked mobile dependencies..."
  npm ci --prefix "$APP_DIR"
fi

# Local Golden User runtime defaults. Both values are public client configuration
# and can be overridden by the caller for another Supabase environment.
export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-https://rqbpbauhkdgsrkbwmkmg.supabase.co}"
export EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-sb_publishable_QEHIwvil9m4lyE6kJ1ba6w_CjA9_XXh}"
export EXPO_PUBLIC_PALTA_API_BASE_URL="${EXPO_PUBLIC_PALTA_API_BASE_URL:-http://127.0.0.1:${MOCK_PORT}}"
export EXPO_PUBLIC_ENV="${EXPO_PUBLIC_ENV:-development}"
export PALTA_MOCK_BASE_URL="http://127.0.0.1:${MOCK_PORT}"
export EXPO_NO_TELEMETRY=1

case "$EXPO_PUBLIC_ENV" in
  development|preview|production) ;;
  *) fail "EXPO_PUBLIC_ENV must be development, preview, or production." ;;
esac

if [[ ! "$EXPO_PUBLIC_SUPABASE_URL" =~ ^https://[a-zA-Z0-9-]+\.supabase\.co$ ]]; then
  fail "EXPO_PUBLIC_SUPABASE_URL must be an https://<project>.supabase.co URL."
fi
if [[ "$EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" != sb_publishable_* ]]; then
  fail "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key."
fi

if lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  info "Reusing listener on mock API port $MOCK_PORT."
else
  info "Starting Palta mock API on port $MOCK_PORT..."
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

DEVELOPER_DIR="$(xcode-select -p 2>/dev/null || true)"
[ -n "$DEVELOPER_DIR" ] || fail "No active Xcode developer directory."

SIMULATOR_APP="$DEVELOPER_DIR/Applications/Simulator.app"
if [ -d "$SIMULATOR_APP" ]; then
  open "$SIMULATOR_APP" >/dev/null 2>&1 || true
else
  open -a DeviceHub >/dev/null 2>&1 || true
fi

BOOTED_UDID="$(xcrun simctl list devices booted | awk -F '[()]' '/iPhone/ && /Booted/ {print $2; exit}')"
if [ -n "$BOOTED_UDID" ]; then
  UDID="$BOOTED_UDID"
  info "Reusing booted iPhone Simulator: $UDID"
else
  DEVICE_LINE="$(xcrun simctl list devices available | awk '/iPhone 18 Pro/ {print; exit}')"
  if [ -z "$DEVICE_LINE" ]; then
    DEVICE_LINE="$(xcrun simctl list devices available | awk '/iPhone/ {print; exit}')"
  fi
  [ -n "$DEVICE_LINE" ] || fail "No available iPhone Simulator device found."

  UDID="$(printf '%s\n' "$DEVICE_LINE" | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/')"
  [ -n "$UDID" ] && [ "$UDID" != "$DEVICE_LINE" ] || fail "Could not parse Simulator UDID from: $DEVICE_LINE"

  info "Booting iPhone Simulator: $DEVICE_LINE"
  xcrun simctl boot "$UDID" 2>/dev/null || true
fi

xcrun simctl bootstatus "$UDID" -b

cd "$APP_DIR"
info "Building and launching current Palta branch on iOS Simulator..."
npx expo run:ios --device "$UDID"
