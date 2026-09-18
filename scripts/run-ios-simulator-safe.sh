#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="${PALTA_SIMULATOR_BRANCH:-integration/simulator-runtime-fix-v1}"
MOCK_PORT="${PALTA_MOCK_PORT:-8787}"
METRO_PORT="${PALTA_METRO_PORT:-8081}"
PMTILES_URL="https://palta-edge-preflight.kimeuisin.workers.dev/maps/santiago.pmtiles"
BACKUP_DIR=""

fail() {
  echo "FAIL: $1" >&2
  exit "${2:-1}"
}

info() {
  echo "[Palta Simulator] $1"
}

[ "$(uname -s)" = "Darwin" ] || fail "This launcher must run on macOS."

for cmd in git node npm xcrun xcodebuild open lsof curl ps; do
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
git fetch origin "$TARGET_BRANCH:refs/remotes/origin/$TARGET_BRANCH" >/dev/null
REF="origin/$TARGET_BRANCH"
git rev-parse --verify "$REF" >/dev/null 2>&1 || fail "Cannot resolve $REF after fetch."

ensure_backup_dir() {
  if [ -z "$BACKUP_DIR" ]; then
    BACKUP_DIR="/tmp/palta-simulator-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
  fi
}

sync_ref_file() {
  SOURCE_PATH="$1"
  DEST_PATH="$2"
  LABEL="$3"

  git cat-file -e "$REF:$SOURCE_PATH" 2>/dev/null || fail "Recovery source missing: $SOURCE_PATH"
  TMP_SOURCE="$(mktemp /tmp/palta-sync.XXXXXX)"
  git show "$REF:$SOURCE_PATH" > "$TMP_SOURCE"
  mkdir -p "$(dirname "$DEST_PATH")"

  if [ -f "$DEST_PATH" ] && ! cmp -s "$TMP_SOURCE" "$DEST_PATH"; then
    ensure_backup_dir
    SAFE_NAME="$(printf '%s' "$SOURCE_PATH" | tr '/' '_')"
    cp "$DEST_PATH" "$BACKUP_DIR/$SAFE_NAME"
    info "Backed up previous $LABEL to $BACKUP_DIR/$SAFE_NAME"
  fi

  if [ ! -f "$DEST_PATH" ] || ! cmp -s "$TMP_SOURCE" "$DEST_PATH"; then
    cp "$TMP_SOURCE" "$DEST_PATH"
    info "Applied verified $LABEL."
  else
    info "$LABEL is already present."
  fi
  rm -f "$TMP_SOURCE"
}

sync_ref_file \
  "mobile-overlay/src/hooks/useAsyncResource.ts" \
  "$APP_DIR/src/hooks/useAsyncResource.ts" \
  "async-resource loop fix"

sync_ref_file \
  "mobile-overlay/src/components/map/NeighborhoodMap.tsx" \
  "$APP_DIR/src/components/map/NeighborhoodMap.tsx" \
  "MapLibre map component"

sync_ref_file \
  "mobile-overlay/src/components/map/paltaDevelopmentMapStyle.ts" \
  "$APP_DIR/src/components/map/paltaDevelopmentMapStyle.ts" \
  "Santiago PMTiles development style"

sync_ref_file \
  "mobile-overlay/src/features/neighborhood/NeighborhoodScreen.tsx" \
  "$APP_DIR/src/features/neighborhood/NeighborhoodScreen.tsx" \
  "Neighborhood map integration"

# Prove that the local app now contains the PMTiles map integration before launch.
grep -q "PALTA_DEVELOPMENT_MAP_STYLE" "$APP_DIR/src/features/neighborhood/NeighborhoodScreen.tsx" \
  || fail "Neighborhood map integration marker is missing from the local app."
grep -q "showLoadStatus" "$APP_DIR/src/components/map/NeighborhoodMap.tsx" \
  || fail "Map load-state diagnostic marker is missing from the local app."
info "Verified local app contains the new map integration."

# Verify the deployed PMTiles endpoint really supports byte ranges from this Mac.
RANGE_HEADERS="$(mktemp /tmp/palta-map-range.XXXXXX.headers)"
RANGE_BODY="$(mktemp /tmp/palta-map-range.XXXXXX.bin)"
HTTP_CODE="$(curl -sS -D "$RANGE_HEADERS" -o "$RANGE_BODY" -H 'Range: bytes=0-15' -w '%{http_code}' "$PMTILES_URL" || true)"
RANGE_BYTES="$(wc -c < "$RANGE_BODY" | tr -d ' ')"
if [ "$HTTP_CODE" != "206" ] || [ "$RANGE_BYTES" != "16" ]; then
  echo "--- PMTiles response headers ---" >&2
  cat "$RANGE_HEADERS" >&2 || true
  rm -f "$RANGE_HEADERS" "$RANGE_BODY"
  fail "Santiago PMTiles range check failed (HTTP $HTTP_CODE, bytes $RANGE_BYTES)."
fi
info "Santiago PMTiles range check passed (HTTP 206, 16 bytes)."
rm -f "$RANGE_HEADERS" "$RANGE_BODY"

SMOKE_PATH="dev/mock-api/smoke.mjs"
git cat-file -e "$REF:$SMOKE_PATH" 2>/dev/null || fail "Recovery smoke test missing: $SMOKE_PATH"
TMP_SMOKE="$(mktemp /tmp/palta-smoke.XXXXXX.mjs)"
trap 'rm -f "$TMP_SMOKE"' EXIT
git show "$REF:$SMOKE_PATH" > "$TMP_SMOKE"

# Simulator recovery always uses the local development API for this launch.
# These exports are process-local; no .env file is overwritten.
export EXPO_PUBLIC_PALTA_API_BASE_URL="http://127.0.0.1:${MOCK_PORT}"
export EXPO_PUBLIC_ENV="development"
export PALTA_MOCK_BASE_URL="http://127.0.0.1:${MOCK_PORT}"
export EXPO_NO_CACHE=1

if lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  info "Port $MOCK_PORT already has a listener; reusing it for smoke verification."
else
  info "Starting Palta development mock API on port $MOCK_PORT..."
  PALTA_MOCK_PORT="$MOCK_PORT" nohup node "$ROOT/dev/mock-api/server.mjs" >/tmp/palta-mock-api.log 2>&1 &
  echo $! >/tmp/palta-mock-api.pid
  sleep 1
fi

if ! node "$TMP_SMOKE"; then
  echo "--- mock API log ---" >&2
  tail -80 /tmp/palta-mock-api.log 2>/dev/null || true
  fail "Mock API smoke test failed."
fi
info "Mock API smoke test passed."

DEVELOPER_DIR="$(xcode-select -p 2>/dev/null || true)"
SIMULATOR_APP="${DEVELOPER_DIR}/Applications/Simulator.app"
if [ -d "$SIMULATOR_APP" ]; then
  info "Opening Simulator from Xcode developer directory..."
  open "$SIMULATOR_APP" >/dev/null 2>&1 || true
else
  info "Simulator.app not found by path; continuing with simctl boot."
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

MAPLIBRE_RN_VERSION="$(node -e "try{process.stdout.write(require('./node_modules/@maplibre/maplibre-react-native/package.json').version)}catch(e){process.stdout.write('NOT_FOUND')}" )"
info "MapLibre React Native version: $MAPLIBRE_RN_VERSION"
if [ -f "$APP_DIR/ios/Podfile.lock" ]; then
  MAPLIBRE_PODS="$(grep -Ei 'maplibre' "$APP_DIR/ios/Podfile.lock" | head -8 || true)"
  if [ -n "$MAPLIBRE_PODS" ]; then
    echo "[Palta Simulator] Installed iOS MapLibre pods:"
    printf '%s\n' "$MAPLIBRE_PODS"
  fi
fi

# Stop the old Palta Metro process so it cannot serve a stale bundle.
METRO_PIDS="$(lsof -nP -iTCP:"$METRO_PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
if [ -n "$METRO_PIDS" ]; then
  info "Stopping existing Metro listener on port $METRO_PORT to remove stale bundle state..."
  for pid in $METRO_PIDS; do
    kill "$pid" 2>/dev/null || true
  done
  sleep 1
fi

rm -rf "$APP_DIR/.expo"
info "Starting a fresh Metro bundler with cache cleared..."
nohup npx expo start --clear --port "$METRO_PORT" >/tmp/palta-metro.log 2>&1 &
echo $! >/tmp/palta-metro.pid

for _ in $(seq 1 30); do
  if lsof -nP -iTCP:"$METRO_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! lsof -nP -iTCP:"$METRO_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "--- Metro log ---" >&2
  tail -120 /tmp/palta-metro.log 2>/dev/null || true
  fail "Fresh Metro bundler did not start on port $METRO_PORT."
fi
info "Fresh Metro bundler is ready on port $METRO_PORT."

info "Rebuilding, installing, and launching Palta with native build cache cleared..."
info "Target UDID: $UDID"
npx expo run:ios --device "$UDID" --port "$METRO_PORT" --no-bundler --no-build-cache
