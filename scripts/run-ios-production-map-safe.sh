#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "FAIL: run this from inside the Palta repository." >&2; exit 1; }
cd "$ROOT"

APP_DIR="${PALTA_IOS_APP_DIR:-$ROOT/apps/mobile}"
MAP_STYLE_URL="${EXPO_PUBLIC_MAP_STYLE_URL:-https://palta-map-edge.kimeuisin.workers.dev/maps/cl/style.json}"
MOCK_PORT="${PALTA_MOCK_PORT:-8787}"
BACKUP_DIR=""

fail() {
  echo "FAIL: $1" >&2
  exit "${2:-1}"
}

info() {
  echo "[Palta iOS Map] $1"
}

[ "$(uname -s)" = "Darwin" ] || fail "This launcher must run on macOS."
for cmd in git node npm npx xcrun open lsof cp mkdir mktemp; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

[ -f "$APP_DIR/package.json" ] || fail "Existing Expo app not found at $APP_DIR. The production map infrastructure is healthy; only the local app path must be resolved."

ensure_backup_dir() {
  if [ -z "$BACKUP_DIR" ]; then
    BACKUP_DIR="/tmp/palta-ios-map-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
  fi
}

copy_overlay() {
  local src="$1"
  local dest="$2"
  local label="$3"
  [ -f "$src" ] || fail "Missing overlay source: $src"
  mkdir -p "$(dirname "$dest")"
  if [ -f "$dest" ] && ! cmp -s "$src" "$dest"; then
    ensure_backup_dir
    cp "$dest" "$BACKUP_DIR/$(printf '%s' "$label" | tr ' /' '__')"
  fi
  cp "$src" "$dest"
  info "Installed $label"
}

adjust_repo_root_imports() {
  local file="$1"
  node - "$file" <<'NODE'
const fs = require('fs');
const path = process.argv[2];
const before = fs.readFileSync(path, 'utf8');
const after = before
  .replaceAll("from '../../../../src/", "from '../../../../../src/")
  .replaceAll('from "../../../../src/', 'from "../../../../../src/');
if (after !== before) fs.writeFileSync(path, after);
NODE
}

copy_overlay \
  "$ROOT/mobile-overlay/src/components/map/NeighborhoodMap.tsx" \
  "$APP_DIR/src/components/map/NeighborhoodMap.tsx" \
  "NeighborhoodMap.tsx"
adjust_repo_root_imports "$APP_DIR/src/components/map/NeighborhoodMap.tsx"

copy_overlay \
  "$ROOT/mobile-overlay/src/components/neighborhood/MapResultSheet.tsx" \
  "$APP_DIR/src/components/neighborhood/MapResultSheet.tsx" \
  "MapResultSheet.tsx"
adjust_repo_root_imports "$APP_DIR/src/components/neighborhood/MapResultSheet.tsx"

copy_overlay \
  "$ROOT/mobile-overlay/src/features/neighborhood/NeighborhoodScreen.tsx" \
  "$APP_DIR/src/features/neighborhood/NeighborhoodScreen.tsx" \
  "NeighborhoodScreen.tsx"
adjust_repo_root_imports "$APP_DIR/src/features/neighborhood/NeighborhoodScreen.tsx"

copy_overlay \
  "$ROOT/mobile-overlay/src/app/map/index.tsx" \
  "$APP_DIR/src/app/map/index.tsx" \
  "map/index.tsx"

ENV_LOCAL="$APP_DIR/.env.local"
python3 - "$ENV_LOCAL" "$MOCK_PORT" "$MAP_STYLE_URL" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
mock_port = sys.argv[2]
style_url = sys.argv[3]
values = {}
if path.exists():
    for line in path.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            values[k] = v
values['EXPO_PUBLIC_PALTA_API_BASE_URL'] = f'http://127.0.0.1:{mock_port}'
values['EXPO_PUBLIC_ENV'] = 'development'
values['EXPO_PUBLIC_MAP_STYLE_URL'] = style_url
path.write_text('\n'.join(f'{k}={v}' for k, v in values.items()) + '\n', encoding='utf-8')
PY
info "Pinned production Chile Map Core in $ENV_LOCAL"

if lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  info "Mock API already running on port $MOCK_PORT"
else
  info "Starting local Palta mock API on port $MOCK_PORT"
  PALTA_MOCK_PORT="$MOCK_PORT" nohup node "$ROOT/dev/mock-api/server.mjs" >/tmp/palta-mock-api.log 2>&1 &
  echo $! >/tmp/palta-mock-api.pid
  sleep 1
  lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t >/dev/null 2>&1 || {
    tail -80 /tmp/palta-mock-api.log 2>/dev/null || true
    fail "Mock API failed to start"
  }
fi

DEVELOPER_DIR="$(xcode-select -p 2>/dev/null || true)"
SIMULATOR_APP="${DEVELOPER_DIR}/Applications/Simulator.app"
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
  [ -n "$DEVICE_LINE" ] || fail "No available iPhone Simulator found"
  UDID="$(printf '%s\n' "$DEVICE_LINE" | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/')"
  [ -n "$UDID" ] && [ "$UDID" != "$DEVICE_LINE" ] || fail "Could not parse Simulator UDID"
  xcrun simctl boot "$UDID" 2>/dev/null || true
fi
xcrun simctl bootstatus "$UDID" -b

cd "$APP_DIR"
if [ ! -d node_modules ]; then
  info "Installing mobile dependencies"
  npm install
fi

export EXPO_PUBLIC_PALTA_API_BASE_URL="http://127.0.0.1:${MOCK_PORT}"
export EXPO_PUBLIC_ENV="development"
export EXPO_PUBLIC_MAP_STYLE_URL="$MAP_STYLE_URL"

info "Launching Palta with verified Chile production map"
info "Map style: $MAP_STYLE_URL"
info "Simulator: $UDID"
exec npx expo run:ios --device "$UDID"
