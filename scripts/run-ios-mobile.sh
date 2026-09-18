#!/usr/bin/env bash
set -euo pipefail

MOCK_PORT="${PALTA_MOCK_PORT:-8787}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel)"
APP_DIR="$ROOT/apps/mobile"
RUNTIME_WATCH_PID=""
RUNTIME_MODE="${PALTA_RUNTIME_MODE:-full}"
DEFAULT_MAP_STYLE_URL="${PALTA_MAP_STYLE_URL:-https://palta-edge-preflight.kimeuisin.workers.dev/maps/style.json}"
DEFAULT_SUPABASE_URL="https://rqbpbauhkdgsrkbwmkmg.supabase.co"
DEFAULT_SUPABASE_PUBLISHABLE_KEY="sb_publishable_QEHIwvil9m4lyE6kJ1ba6w_CjA9_XXh"
COMPOSITION_BRANCH="integration/runtime-composition-v1"
COMPOSITION_MANIFEST="$ROOT/manifest/mobile-runtime-composition.json"

fail() {
  echo "FAIL: $1" >&2
  exit "${2:-1}"
}

info() {
  echo "[Palta iOS] $1"
}

cleanup() {
  if [ -n "$RUNTIME_WATCH_PID" ]; then
    kill "$RUNTIME_WATCH_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

load_persisted_map_style() {
  local env_file="$APP_DIR/.env.local"
  [ -f "$env_file" ] || return 0

  while IFS='=' read -r key value; do
    case "$key" in
      EXPO_PUBLIC_MAP_STYLE_URL)
        if [ -z "${EXPO_PUBLIC_MAP_STYLE_URL:-}" ] && [ -n "$value" ]; then
          export EXPO_PUBLIC_MAP_STYLE_URL="$value"
        fi
        ;;
    esac
  done < "$env_file"
}

validate_public_auth_config() {
  case "$EXPO_PUBLIC_SUPABASE_URL" in
    https://*.supabase.co) ;;
    *) fail "EXPO_PUBLIC_SUPABASE_URL must be an https://<project>.supabase.co URL." ;;
  esac

  case "$EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" in
    sb_publishable_*) ;;
    *) fail "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a publishable key." ;;
  esac
}

mock_listener_pids() {
  lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t 2>/dev/null || true
}

start_mock_api() {
  info "Starting Palta mock API on port $MOCK_PORT..."
  PALTA_MOCK_PORT="$MOCK_PORT" nohup node "$ROOT/dev/mock-api/server.mjs" >/tmp/palta-mock-api.log 2>&1 &
  echo $! >/tmp/palta-mock-api.pid
  sleep 1
}

stop_stale_palta_mock_api() {
  local pids
  pids="$(mock_listener_pids)"
  [ -n "$pids" ] || return 0

  local pid command
  for pid in $pids; do
    command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    case "$command" in
      *dev/mock-api/server.mjs*)
        info "Stopping stale Palta mock API process $pid..."
        kill "$pid" >/dev/null 2>&1 || true
        ;;
      *)
        fail "Port $MOCK_PORT is occupied by a non-Palta process (PID $pid). Stop it or set PALTA_MOCK_PORT to another port."
        ;;
    esac
  done

  local attempt=0
  while [ -n "$(mock_listener_pids)" ] && [ "$attempt" -lt 20 ]; do
    sleep 0.15
    attempt=$((attempt + 1))
  done

  [ -z "$(mock_listener_pids)" ] || fail "Could not release mock API port $MOCK_PORT."
}

verify_mock_api() {
  node "$ROOT/dev/mock-api/smoke.mjs"
}

start_runtime_watcher() {
  local current_branch="$1"
  if [ "$RUNTIME_MODE" = "gate01_auth" ]; then
    info "Starting Gate 01 Auth-isolated mobile-overlay sync..."
    node "$ROOT/scripts/sync-mobile-runtime.mjs" --watch >/tmp/palta-mobile-runtime-sync.log 2>&1 &
  elif [ "$current_branch" = "$COMPOSITION_BRANCH" ] && [ -f "$COMPOSITION_MANIFEST" ]; then
    info "Starting composed runtime watcher (Home + Negocios + Community + Auth)..."
    bash "$ROOT/scripts/watch-runtime-composition.sh" >/tmp/palta-runtime-composition.log 2>&1 &
  else
    info "Starting live mobile-overlay sync for Expo Fast Refresh..."
    node "$ROOT/scripts/sync-mobile-runtime.mjs" --watch >/tmp/palta-mobile-runtime-sync.log 2>&1 &
  fi
  RUNTIME_WATCH_PID=$!
  sleep 0.4
  if ! kill -0 "$RUNTIME_WATCH_PID" >/dev/null 2>&1; then
    tail -100 /tmp/palta-runtime-composition.log 2>/dev/null || true
    tail -100 /tmp/palta-mobile-runtime-sync.log 2>/dev/null || true
    fail "Live mobile runtime watcher failed to start."
  fi
}

[ "$(uname -s)" = "Darwin" ] || fail "iOS Simulator launch requires macOS."
for cmd in git node npm xcrun xcode-select open lsof ps; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

case "$RUNTIME_MODE" in
  full|gate01_auth) ;;
  *) fail "Unsupported PALTA_RUNTIME_MODE: $RUNTIME_MODE" ;;
esac

[ -f "$APP_DIR/package.json" ] || fail "Versioned mobile shell missing at $APP_DIR."

NODE_MAJOR="$(node -e "process.stdout.write(process.versions.node.split('.')[0])")"
[ "$NODE_MAJOR" -ge 22 ] || fail "Node 22+ required; found $(node -v)."

cd "$ROOT"
CURRENT_BRANCH="$(git branch --show-current)"
if [ "$RUNTIME_MODE" = "gate01_auth" ]; then
  [ "$CURRENT_BRANCH" = "$COMPOSITION_BRANCH" ] || fail "Gate 01 Auth test must run from $COMPOSITION_BRANCH."
  info "Gate 01 Auth-isolated runtime: materializing versioned mobile-overlay only."
  info "Unrelated live feature overlays are intentionally excluded from this Auth/session test."
  node scripts/sync-mobile-runtime.mjs
elif [ "$CURRENT_BRANCH" = "$COMPOSITION_BRANCH" ] && [ -f "$COMPOSITION_MANIFEST" ]; then
  info "Validating composed mobile runtime..."
  node scripts/check-mobile-runtime-composition.mjs
  info "Composing reviewed surfaces with live feature overlays..."
  node scripts/compose-mobile-runtime.mjs
else
  info "Materializing the current branch mobile overlay..."
  node scripts/sync-mobile-runtime.mjs
fi

if [ ! -d "$APP_DIR/node_modules" ]; then
  if [ -f "$APP_DIR/package-lock.json" ]; then
    info "Installing locked mobile dependencies..."
    npm ci --prefix "$APP_DIR"
  else
    info "Installing mobile dependencies..."
    npm install --prefix "$APP_DIR"
  fi
fi

if [ "$RUNTIME_MODE" = "gate01_auth" ]; then
  info "Typechecking Gate 01 Auth-isolated simulator runtime..."
  (cd "$APP_DIR" && npx tsc --noEmit)
fi

start_runtime_watcher "$CURRENT_BRANCH"

export EXPO_PUBLIC_PALTA_API_BASE_URL="http://127.0.0.1:${MOCK_PORT}"
export EXPO_PUBLIC_ENV="development"
if [ "$RUNTIME_MODE" = "full" ]; then
  export EXPO_PUBLIC_PALTA_PREVIEW="1"
else
  unset EXPO_PUBLIC_PALTA_PREVIEW 2>/dev/null || true
fi
export EXPO_PUBLIC_SUPABASE_URL="${EXPO_PUBLIC_SUPABASE_URL:-$DEFAULT_SUPABASE_URL}"
export EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-$DEFAULT_SUPABASE_PUBLISHABLE_KEY}"
export PALTA_MOCK_BASE_URL="http://127.0.0.1:${MOCK_PORT}"
export EXPO_NO_TELEMETRY=1

validate_public_auth_config
info "Supabase Auth: $EXPO_PUBLIC_SUPABASE_URL (publishable key only)"

load_persisted_map_style
if [ -z "${EXPO_PUBLIC_MAP_STYLE_URL:-}" ]; then
  export EXPO_PUBLIC_MAP_STYLE_URL="$DEFAULT_MAP_STYLE_URL"
fi
info "MapLibre style: $EXPO_PUBLIC_MAP_STYLE_URL"

if [ -n "$(mock_listener_pids)" ]; then
  info "Validating existing listener on mock API port $MOCK_PORT..."
  if verify_mock_api >/tmp/palta-mock-smoke.log 2>&1; then
    info "Existing Palta mock API is current; reusing it."
  else
    info "Existing mock API is stale for this branch; restarting it."
    stop_stale_palta_mock_api
    start_mock_api
  fi
else
  start_mock_api
fi

if ! verify_mock_api; then
  echo "--- mock API log ---" >&2
  tail -80 /tmp/palta-mock-api.log 2>/dev/null || true
  echo "--- first smoke failure, if any ---" >&2
  tail -80 /tmp/palta-mock-smoke.log 2>/dev/null || true
  fail "Mock API smoke test failed after restart."
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
info "Building and launching current Palta runtime on iOS Simulator..."
npx expo run:ios --device "$UDID"
