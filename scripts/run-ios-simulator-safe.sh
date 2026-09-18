#!/usr/bin/env bash
set -euo pipefail

MAP_BRANCH="${PALTA_SIMULATOR_BRANCH:-integration/simulator-runtime-fix-v1}"
HOME_BRANCH="${PALTA_HOME_BRANCH:-integration/home-functional-foundation-v1}"
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
info "Fetching verified map recovery source without switching your current branch..."
git fetch origin "$MAP_BRANCH:refs/remotes/origin/$MAP_BRANCH" >/dev/null
MAP_REF="origin/$MAP_BRANCH"
git rev-parse --verify "$MAP_REF" >/dev/null 2>&1 || fail "Cannot resolve $MAP_REF after fetch."

info "Fetching function-first Home source without switching your current branch..."
git fetch origin "$HOME_BRANCH:refs/remotes/origin/$HOME_BRANCH" >/dev/null
HOME_REF="origin/$HOME_BRANCH"
git rev-parse --verify "$HOME_REF" >/dev/null 2>&1 || fail "Cannot resolve $HOME_REF after fetch."

info "Map source:  $MAP_REF @ $(git rev-parse --short "$MAP_REF")"
info "Home source: $HOME_REF @ $(git rev-parse --short "$HOME_REF")"

ensure_backup_dir() {
  if [ -z "$BACKUP_DIR" ]; then
    BACKUP_DIR="/tmp/palta-simulator-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
  fi
}

restore_ref_file() {
  REF_NAME="$1"
  SOURCE_PATH="$2"
  DEST_PATH="$3"
  LABEL="$4"

  git cat-file -e "$REF_NAME:$SOURCE_PATH" 2>/dev/null || fail "Verified source missing: $REF_NAME:$SOURCE_PATH"
  TMP_SOURCE="$(mktemp /tmp/palta-restore.XXXXXX)"
  git show "$REF_NAME:$SOURCE_PATH" > "$TMP_SOURCE"
  mkdir -p "$(dirname "$DEST_PATH")"

  if [ -f "$DEST_PATH" ] && ! cmp -s "$TMP_SOURCE" "$DEST_PATH"; then
    ensure_backup_dir
    SAFE_NAME="$(printf '%s' "$DEST_PATH" | sed "s#^$APP_DIR/##" | tr '/' '_')"
    cp "$DEST_PATH" "$BACKUP_DIR/$SAFE_NAME"
    info "Backed up previous $LABEL to $BACKUP_DIR/$SAFE_NAME"
  fi

  if [ ! -f "$DEST_PATH" ] || ! cmp -s "$TMP_SOURCE" "$DEST_PATH"; then
    cp "$TMP_SOURCE" "$DEST_PATH"
    info "Synced $LABEL."
  else
    info "$LABEL is already on the verified version."
  fi
  rm -f "$TMP_SOURCE"
}

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

bind_mobile_runtime_to_generated_core() {
  FILE_PATH="$1"
  node - "$FILE_PATH" <<'NODE'
const fs = require('fs');
const path = process.argv[2];
const before = fs.readFileSync(path, 'utf8');
const after = before
  .replaceAll("from '../../../src/api/paltaApiClient'", "from '../palta-core/api/paltaApiClient'")
  .replaceAll("from '../../../src/config/runtimeEnv'", "from '../palta-core/config/runtimeEnv'")
  .replaceAll("from '../../../src/api/paltaApiFactory'", "from '../palta-core/api/paltaApiFactory'")
  .replaceAll("from '../../../src/ports/authPort'", "from '../palta-core/ports/authPort'");
if (after !== before) fs.writeFileSync(path, after);
NODE
}

bind_home_view_to_generated_core() {
  FILE_PATH="$1"
  node - "$FILE_PATH" <<'NODE'
const fs = require('fs');
const path = process.argv[2];
const before = fs.readFileSync(path, 'utf8');
const after = before.replaceAll(
  "from '../../../../src/api/paltaApiClient'",
  "from '../../palta-core/api/paltaApiClient'",
);
if (after !== before) fs.writeFileSync(path, after);
NODE
}

make_generated_core_metro_friendly() {
  ROOT_PATH="$1"
  node - "$ROOT_PATH" <<'NODE'
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const before = fs.readFileSync(full, 'utf8');
      const after = before
        .replace(/(from\s+['"]\.{1,2}\/[^'"]+)\.js(['"])/g, '$1$2')
        .replace(/(export\s+type\s+\{[\s\S]*?\}\s+from\s+['"]\.{1,2}\/[^'"]+)\.js(['"])/g, '$1$2');
      if (after !== before) fs.writeFileSync(full, after);
    }
  }
}
walk(root);
NODE
}

# Keep the async loader fix on the function-first Home source too.
restore_ref_file \
  "$HOME_REF" \
  "mobile-overlay/src/hooks/useAsyncResource.ts" \
  "$APP_DIR/src/hooks/useAsyncResource.ts" \
  "async-resource loop fix"

# Map/Barrio stays pinned to the independently verified recovery source.
restore_ref_file \
  "$MAP_REF" \
  "mobile-overlay/src/components/map/NeighborhoodMap.tsx" \
  "$APP_DIR/src/components/map/NeighborhoodMap.tsx" \
  "last working MapLibre component"
adjust_repo_root_imports_for_mobile "$APP_DIR/src/components/map/NeighborhoodMap.tsx"

restore_ref_file \
  "$MAP_REF" \
  "mobile-overlay/src/features/neighborhood/NeighborhoodScreen.tsx" \
  "$APP_DIR/src/features/neighborhood/NeighborhoodScreen.tsx" \
  "last working Barrio screen"
adjust_repo_root_imports_for_mobile "$APP_DIR/src/features/neighborhood/NeighborhoodScreen.tsx"

if grep -q "from '../../../../src/" "$APP_DIR/src/components/map/NeighborhoodMap.tsx"; then
  fail "NeighborhoodMap still has an overlay-relative repository import."
fi
if grep -q "from '../../../../src/" "$APP_DIR/src/features/neighborhood/NeighborhoodScreen.tsx"; then
  fail "NeighborhoodScreen still has an overlay-relative repository import."
fi
info "Verified Map/Barrio imports are adjusted for apps/mobile depth."

# Create a bounded, generated core snapshot for the simulator. This avoids
# switching branches or modifying repository-root src/ files while ensuring the
# mobile runtime uses exactly the Home API contract being tested.
GENERATED_CORE="$APP_DIR/src/palta-core"
restore_ref_file "$HOME_REF" "src/api/homeApiContract.ts" "$GENERATED_CORE/api/homeApiContract.ts" "Home API contract snapshot"
restore_ref_file "$HOME_REF" "src/api/notificationApiContract.ts" "$GENERATED_CORE/api/notificationApiContract.ts" "Notification API contract snapshot"
restore_ref_file "$HOME_REF" "src/api/profileApiContract.ts" "$GENERATED_CORE/api/profileApiContract.ts" "Profile API contract snapshot"
restore_ref_file "$HOME_REF" "src/api/paltaApiClient.ts" "$GENERATED_CORE/api/paltaApiClient.ts" "Palta API client snapshot"
restore_ref_file "$HOME_REF" "src/api/paltaApiFactory.ts" "$GENERATED_CORE/api/paltaApiFactory.ts" "Palta API factory snapshot"
restore_ref_file "$HOME_REF" "src/config/runtimeEnv.ts" "$GENERATED_CORE/config/runtimeEnv.ts" "runtime environment snapshot"
restore_ref_file "$HOME_REF" "src/ports/authPort.ts" "$GENERATED_CORE/ports/authPort.ts" "auth port snapshot"
restore_ref_file "$HOME_REF" "src/notification/inboxModel.ts" "$GENERATED_CORE/notification/inboxModel.ts" "notification inbox model snapshot"
make_generated_core_metro_friendly "$GENERATED_CORE"

# Sync only the bounded Home runtime/UI files. Do not copy the whole overlay.
restore_ref_file "$HOME_REF" "mobile-overlay/src/services/paltaClient.ts" "$APP_DIR/src/services/paltaClient.ts" "functional mobile Palta client"
bind_mobile_runtime_to_generated_core "$APP_DIR/src/services/paltaClient.ts"

restore_ref_file "$HOME_REF" "mobile-overlay/src/components/AsyncStateBlock.tsx" "$APP_DIR/src/components/AsyncStateBlock.tsx" "Home async-state component"
restore_ref_file "$HOME_REF" "mobile-overlay/src/components/common/PaltaButton.tsx" "$APP_DIR/src/components/common/PaltaButton.tsx" "Palta button"
restore_ref_file "$HOME_REF" "mobile-overlay/src/components/home/ActionSurface.tsx" "$APP_DIR/src/components/home/ActionSurface.tsx" "Home action surface"
restore_ref_file "$HOME_REF" "mobile-overlay/src/components/home/GlanceCluster.tsx" "$APP_DIR/src/components/home/GlanceCluster.tsx" "Home glance cluster"
restore_ref_file "$HOME_REF" "mobile-overlay/src/components/home/SummaryListRow.tsx" "$APP_DIR/src/components/home/SummaryListRow.tsx" "Home summary row"

restore_ref_file "$HOME_REF" "mobile-overlay/src/features/home/demoLegacyLifeCards.ts" "$APP_DIR/src/features/home/demoLegacyLifeCards.ts" "complete Home life-card demo fixtures"
bind_home_view_to_generated_core "$APP_DIR/src/features/home/demoLegacyLifeCards.ts"

restore_ref_file "$HOME_REF" "mobile-overlay/src/features/home/HomeScreen.tsx" "$APP_DIR/src/features/home/HomeScreen.tsx" "function-first Home screen"
bind_home_view_to_generated_core "$APP_DIR/src/features/home/HomeScreen.tsx"

restore_ref_file "$HOME_REF" "mobile-overlay/src/app/activity/notifications.tsx" "$APP_DIR/src/app/activity/notifications.tsx" "notification inbox route"
bind_home_view_to_generated_core "$APP_DIR/src/app/activity/notifications.tsx"

restore_ref_file "$HOME_REF" "mobile-overlay/src/app/context/[contextId].tsx" "$APP_DIR/src/app/context/[contextId].tsx" "Home context/profile route"
bind_home_view_to_generated_core "$APP_DIR/src/app/context/[contextId].tsx"

# The Care target used by Home must exist in the local app.
restore_ref_file "$HOME_REF" "mobile-overlay/src/app/care/[careTrackId].tsx" "$APP_DIR/src/app/care/[careTrackId].tsx" "Care detail route"

EXPERIMENTAL_STYLE="$APP_DIR/src/components/map/paltaDevelopmentMapStyle.ts"
if [ -f "$EXPERIMENTAL_STYLE" ]; then
  ensure_backup_dir
  cp "$EXPERIMENTAL_STYLE" "$BACKUP_DIR/paltaDevelopmentMapStyle.ts"
  rm -f "$EXPERIMENTAL_STYLE"
  info "Removed failed experimental PMTiles style from local app."
fi

# Run the exact Home-branch mock server and smoke without touching the current
# checkout's dev/mock-api files.
TMP_SERVER="$(mktemp /tmp/palta-mock-server.XXXXXX.mjs)"
TMP_SMOKE="$(mktemp /tmp/palta-smoke.XXXXXX.mjs)"
trap 'rm -f "$TMP_SERVER" "$TMP_SMOKE"' EXIT
git show "$HOME_REF:dev/mock-api/server.mjs" > "$TMP_SERVER"
git show "$HOME_REF:dev/mock-api/smoke.mjs" > "$TMP_SMOKE"

export EXPO_PUBLIC_PALTA_API_BASE_URL="http://127.0.0.1:${MOCK_PORT}"
export EXPO_PUBLIC_ENV="development"
export PALTA_MOCK_BASE_URL="http://127.0.0.1:${MOCK_PORT}"

LISTENER_PID="$(lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
KNOWN_PID="$(cat /tmp/palta-mock-api.pid 2>/dev/null || true)"

if [ -n "$LISTENER_PID" ] && [ -n "$KNOWN_PID" ] && [ "$LISTENER_PID" = "$KNOWN_PID" ]; then
  info "Restarting managed Palta mock API so it matches the latest Home source..."
  kill "$LISTENER_PID" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t >/dev/null 2>&1 || break
    sleep 0.2
  done
  LISTENER_PID=""
fi

if [ -z "$LISTENER_PID" ]; then
  info "Starting functional Palta development mock API on port $MOCK_PORT..."
  PALTA_MOCK_PORT="$MOCK_PORT" PALTA_MOCK_HOST="127.0.0.1" \
    nohup node "$TMP_SERVER" >/tmp/palta-mock-api.log 2>&1 &
  echo $! >/tmp/palta-mock-api.pid
  sleep 1
else
  info "Port $MOCK_PORT is already in use; verifying that listener before reuse..."
fi

if ! node "$TMP_SMOKE"; then
  echo "--- mock API log ---" >&2
  tail -80 /tmp/palta-mock-api.log 2>/dev/null || true
  fail "Functional mock API smoke test failed. If port $MOCK_PORT belongs to another process, stop that process or set PALTA_MOCK_PORT."
fi
info "Functional Home + notification + profile mock smoke test passed."

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

info "Building, installing, and launching Palta with verified Map + functional Home sources..."
info "Target UDID: $UDID"
npx expo run:ios --device "$UDID"
