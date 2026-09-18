#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="${PALTA_HOME_BRANCH:-integration/home-runtime-v1}"
MOCK_PORT="${PALTA_MOCK_PORT:-8787}"
BACKUP_DIR=""

fail() {
  echo "FAIL: $1" >&2
  exit "${2:-1}"
}

info() {
  echo "[Palta Home] $1"
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || fail "Run this from inside the Palta git repository."
cd "$ROOT"

APP_DIR="$ROOT/apps/mobile"
[ -f "$APP_DIR/package.json" ] || fail "Existing Expo app not found at $APP_DIR."
command -v node >/dev/null 2>&1 || fail "Required command not found: node"

info "Fetching $TARGET_BRANCH without switching your current branch..."
git fetch origin "$TARGET_BRANCH:refs/remotes/origin/$TARGET_BRANCH" >/dev/null
REF="origin/$TARGET_BRANCH"
git rev-parse --verify "$REF" >/dev/null 2>&1 || fail "Cannot resolve $REF after fetch."

ensure_backup_dir() {
  if [ -z "$BACKUP_DIR" ]; then
    BACKUP_DIR="/tmp/palta-home-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
  fi
}

sync_ref_file() {
  SOURCE_PATH="$1"
  DEST_PATH="$2"
  LABEL="$3"

  git cat-file -e "$REF:$SOURCE_PATH" 2>/dev/null || fail "Home source missing: $SOURCE_PATH"
  TMP_SOURCE="$(mktemp /tmp/palta-home-sync.XXXXXX)"
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
    info "Applied $LABEL."
  else
    info "$LABEL is already present."
  fi
  rm -f "$TMP_SOURCE"
}

sync_mobile_home_screen() {
  SOURCE_PATH="mobile-overlay/src/features/home/HomeScreen.tsx"
  DEST_PATH="$APP_DIR/src/features/home/HomeScreen.tsx"
  LABEL="runtime Home screen"

  git cat-file -e "$REF:$SOURCE_PATH" 2>/dev/null || fail "Home source missing: $SOURCE_PATH"
  TMP_SOURCE="$(mktemp /tmp/palta-home-screen.XXXXXX)"
  git show "$REF:$SOURCE_PATH" > "$TMP_SOURCE"

  node - "$TMP_SOURCE" <<'NODE'
const fs = require('node:fs');
const file = process.argv[2];
let source = fs.readFileSync(file, 'utf8');
const repoPrefix = '../../../../src/home/';
const appPrefix = '../../../../../src/home/';
if (!source.includes(repoPrefix)) {
  console.error('Expected repository Home import prefix was not found.');
  process.exit(1);
}
source = source.split(repoPrefix).join(appPrefix);
fs.writeFileSync(file, source);
NODE

  mkdir -p "$(dirname "$DEST_PATH")"
  if [ -f "$DEST_PATH" ] && ! cmp -s "$TMP_SOURCE" "$DEST_PATH"; then
    ensure_backup_dir
    cp "$DEST_PATH" "$BACKUP_DIR/mobile-overlay_src_features_home_HomeScreen.tsx"
    info "Backed up previous $LABEL to $BACKUP_DIR/mobile-overlay_src_features_home_HomeScreen.tsx"
  fi

  if [ ! -f "$DEST_PATH" ] || ! cmp -s "$TMP_SOURCE" "$DEST_PATH"; then
    cp "$TMP_SOURCE" "$DEST_PATH"
    info "Applied $LABEL with apps/mobile import paths."
  else
    info "$LABEL is already present with apps/mobile import paths."
  fi
  rm -f "$TMP_SOURCE"
}

sync_mobile_home_screen

sync_ref_file \
  "mobile-overlay/src/components/home/ActionSurface.tsx" \
  "$APP_DIR/src/components/home/ActionSurface.tsx" \
  "Home primary action surface"

sync_ref_file \
  "mobile-overlay/src/components/home/GlanceCluster.tsx" \
  "$APP_DIR/src/components/home/GlanceCluster.tsx" \
  "Home glance cluster"

sync_ref_file \
  "mobile-overlay/src/components/home/SummaryListRow.tsx" \
  "$APP_DIR/src/components/home/SummaryListRow.tsx" \
  "Home summary row"

sync_ref_file \
  "mobile-overlay/src/theme/paltaTheme.ts" \
  "$APP_DIR/src/theme/paltaTheme.ts" \
  "Palta semantic theme"

sync_ref_file \
  "src/api/paltaApiClient.ts" \
  "$ROOT/src/api/paltaApiClient.ts" \
  "Home API response contract"

sync_ref_file \
  "src/home/homeRuntimeContract.ts" \
  "$ROOT/src/home/homeRuntimeContract.ts" \
  "Home runtime contract"

sync_ref_file \
  "src/home/selectHomeDisplayItems.ts" \
  "$ROOT/src/home/selectHomeDisplayItems.ts" \
  "Home display selection"

sync_ref_file \
  "src/ui/contentDensity.ts" \
  "$ROOT/src/ui/contentDensity.ts" \
  "Home content density policy"

sync_ref_file \
  "src/home/homeSourceContract.ts" \
  "$ROOT/src/home/homeSourceContract.ts" \
  "Home source adapter contract"

sync_ref_file \
  "src/home/homeApiProjection.ts" \
  "$ROOT/src/home/homeApiProjection.ts" \
  "Home API candidate projection"

sync_ref_file \
  "src/home/mergeHomeSources.ts" \
  "$ROOT/src/home/mergeHomeSources.ts" \
  "Home source merger"

sync_ref_file \
  "src/home/adapters/weatherHomeAdapter.ts" \
  "$ROOT/src/home/adapters/weatherHomeAdapter.ts" \
  "Weather Home adapter"

sync_ref_file \
  "src/home/adapters/mobilityHomeAdapter.ts" \
  "$ROOT/src/home/adapters/mobilityHomeAdapter.ts" \
  "Mobility Home adapter"

sync_ref_file \
  "src/journey/journeyContract.ts" \
  "$ROOT/src/journey/journeyContract.ts" \
  "Journey contract snapshot"

sync_ref_file \
  "src/home/adapters/journeyHomeBridge.ts" \
  "$ROOT/src/home/adapters/journeyHomeBridge.ts" \
  "Journey to Home bridge"

sync_ref_file \
  "src/home/adapters/careHomeAdapter.ts" \
  "$ROOT/src/home/adapters/careHomeAdapter.ts" \
  "Care lifecycle Home adapter"

sync_ref_file \
  "src/home/adapters/scheduledEventHomeAdapter.ts" \
  "$ROOT/src/home/adapters/scheduledEventHomeAdapter.ts" \
  "PRÓXIMO scheduled-event adapter"

sync_ref_file \
  "src/home/adapters/publicLifeNewsHomeAdapters.ts" \
  "$ROOT/src/home/adapters/publicLifeNewsHomeAdapters.ts" \
  "Public-life and news Home adapters"

[ -f "$ROOT/src/home/homeRuntimeContract.ts" ] || fail "Synced Home runtime contract is missing."
[ -f "$ROOT/src/home/selectHomeDisplayItems.ts" ] || fail "Synced Home display selector is missing."
if grep -Fq "../../../../src/home/" "$APP_DIR/src/features/home/HomeScreen.tsx"; then
  fail "HomeScreen still contains repository-only import paths after mobile sync."
fi
if ! grep -Fq "../../../../../src/home/" "$APP_DIR/src/features/home/HomeScreen.tsx"; then
  fail "HomeScreen mobile import paths were not applied."
fi
info "Verified HomeScreen shared imports for apps/mobile."

sync_ref_file \
  "dev/mock-api/live-weather.mjs" \
  "$ROOT/dev/mock-api/live-weather.mjs" \
  "live development weather bridge"

sync_ref_file \
  "dev/mock-api/live-vitacura.mjs" \
  "$ROOT/dev/mock-api/live-vitacura.mjs" \
  "official Vitacura content bridge"

sync_ref_file \
  "dev/mock-api/server.mjs" \
  "$ROOT/dev/mock-api/server.mjs" \
  "Home development API"

sync_ref_file \
  "dev/mock-api/smoke.mjs" \
  "$ROOT/dev/mock-api/smoke.mjs" \
  "Home development smoke test"

# A stale mock server would hide the new Home payload even when the UI files are correct.
if lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  if curl -fsS "http://127.0.0.1:${MOCK_PORT}/health" 2>/dev/null | grep -q 'palta-mock-api'; then
    info "Restarting the existing Palta mock API so the new Home payload is visible..."
    for pid in $(lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t); do
      kill "$pid" 2>/dev/null || true
    done
    sleep 1
  else
    fail "Port $MOCK_PORT is used by a non-Palta process. Nothing was killed."
  fi
fi

TMP_LAUNCHER="$(mktemp /tmp/palta-home-launcher.XXXXXX.sh)"
trap 'rm -f "$TMP_LAUNCHER"' EXIT
git show "$REF:scripts/run-ios-simulator-safe.sh" > "$TMP_LAUNCHER"
chmod +x "$TMP_LAUNCHER"

info "Launching the verified simulator flow with Home runtime integration..."
PALTA_SIMULATOR_BRANCH="$TARGET_BRANCH" PALTA_MOCK_PORT="$MOCK_PORT" bash "$TMP_LAUNCHER"
