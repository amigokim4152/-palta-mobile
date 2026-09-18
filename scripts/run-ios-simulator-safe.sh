#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="${PALTA_SIMULATOR_BRANCH:-integration/simulator-runtime-fix-v1}"
MOCK_PORT="${PALTA_MOCK_PORT:-8787}"
BACKUP_DIR=""

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
git fetch origin "$TARGET_BRANCH:refs/remotes/origin/$TARGET_BRANCH" >/dev/null
REF="origin/$TARGET_BRANCH"
git rev-parse --verify "$REF" >/dev/null 2>&1 || fail "Cannot resolve $REF after fetch."

ensure_backup_dir() {
  if [ -z "$BACKUP_DIR" ]; then
    BACKUP_DIR="/tmp/palta-simulator-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
  fi
}

restore_ref_file() {
  SOURCE_PATH="$1"
  DEST_PATH="$2"
  LABEL="$3"

  git cat-file -e "$REF:$SOURCE_PATH" 2>/dev/null || fail "Recovery source missing: $SOURCE_PATH"
  TMP_SOURCE="$(mktemp /tmp/palta-restore.XXXXXX)"
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
    info "Restored verified $LABEL."
  else
    info "$LABEL is already on the verified version."
  fi
  rm -f "$TMP_SOURCE"
}

# Overlay files live one directory shallower than apps/mobile. After copying
# them into apps/mobile, only repository-root imports need one more ../.
# Match the full import prefix so repeated runs are idempotent.
adjust_repo_root_imports_for_mobile() {
  FILE_PATH="$1"
  node - "$FILE_PATH" <<'NODE'
const fs = require('fs');
const path = process.argv[2];
const before = fs.readFileSync(path, 'utf8');
const after = before
  .replaceAll("from '../../../../src/", "from '../../../../../src/")
  .replaceAll('from "../../../../src/', 'from "../../../../../src/');
if (after !== before) fs.writeFileSync(path, after);
NODE
}

restore_ref_file \
  "mobile-overlay/src/hooks/useAsyncResource.ts" \
  "$APP_DIR/src/hooks/useAsyncResource.ts" \
  "async-resource loop fix"

restore_ref_file \
  "mobile-overlay/src/components/map/NeighborhoodMap.tsx" \
  "$APP_DIR/src/components/map/NeighborhoodMap.tsx" \
  "last working MapLibre component"
adjust_repo_root_imports_for_mobile "$APP_DIR/src/components/map/NeighborhoodMap.tsx"

restore_ref_file \
  "mobile-overlay/src/features/neighborhood/NeighborhoodScreen.tsx" \
  "$APP_DIR/src/features/neighborhood/NeighborhoodScreen.tsx" \
  "last working Barrio screen"
adjust_repo_root_imports_for_mobile "$APP_DIR/src/features/neighborhood/NeighborhoodScreen.tsx"

# Fail early only when an exact four-level overlay import remains.
if grep -q "from '../../../../src/" "$APP_DIR/src/components/map/NeighborhoodMap.tsx"; then
  fail "NeighborhoodMap still has an overlay-relative repository import."
fi
if grep -q "from '../../../../src/" "$APP_DIR/src/features/neighborhood/NeighborhoodScreen.tsx"; then
  fail "NeighborhoodScreen still has an overlay-relative repository import."
fi
info "Verified mobile repository imports are adjusted for apps/mobile depth."

EXPERIMENTAL_STYLE="$APP_DIR/src/components/map/paltaDevelopmentMapStyle.ts"
if [ -f "$EXPERIMENTAL_STYLE" ]; then
  ensure_backup_dir
  cp "$EXPERIMENTAL_STYLE" "$BACKUP_DIR/paltaDevelopmentMapStyle.ts"
  rm -f "$EXPERIMENTAL_STYLE"
  info "Removed failed experimental PMTiles style from local app."
fi

SMOKE_PATH="dev/mock-api/smoke.mjs"
git cat-file -e "$REF:$SMOKE_PATH" 2>/dev/null || fail "Recovery smoke test missing: $SMOKE_PATH"
TMP_SMOKE="$(mktemp /tmp/palta-smoke.XXXXXX.mjs)"
trap 'rm -f "$TMP_SMOKE"' EXIT
git show "$REF:$SMOKE_PATH" > "$TMP_SMOKE"

export EXPO_PUBLIC_PALTA_API_BASE_URL="http://127.0.0.1:${MOCK_PORT}"
export EXPO_PUBLIC_ENV="development"
export PALTA_MOCK_BASE_URL="http://127.0.0.1:${MOCK_PORT}"

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
  info "Simulator.app not present in this Xcode; opening DeviceHub instead when available..."
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

info "Building, installing, and launching the last verified Palta Simulator state..."
info "Target UDID: $UDID"
npx expo run:ios --device "$UDID"
