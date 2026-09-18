#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="${PALTA_HOME_BASELINE_BRANCH:-integration/home-visual-baseline-v1}"
BACKUP_DIR=""

fail() {
  echo "FAIL: $1" >&2
  exit "${2:-1}"
}

info() {
  echo "[Palta Home Baseline] $1"
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || fail "Run this from inside the Palta git repository."
cd "$ROOT"

APP_DIR="$ROOT/apps/mobile"
[ -f "$APP_DIR/package.json" ] || fail "Existing Expo app not found at $APP_DIR."

info "Fetching $TARGET_BRANCH without switching your current branch..."
git fetch origin "$TARGET_BRANCH:refs/remotes/origin/$TARGET_BRANCH" >/dev/null
REF="origin/$TARGET_BRANCH"
git rev-parse --verify "$REF" >/dev/null 2>&1 || fail "Cannot resolve $REF after fetch."

ensure_backup_dir() {
  if [ -z "$BACKUP_DIR" ]; then
    BACKUP_DIR="/tmp/palta-home-baseline-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
  fi
}

sync_ref_file() {
  SOURCE_PATH="$1"
  DEST_PATH="$2"
  LABEL="$3"

  git cat-file -e "$REF:$SOURCE_PATH" 2>/dev/null || fail "Baseline source missing: $SOURCE_PATH"
  TMP_SOURCE="$(mktemp /tmp/palta-home-baseline.XXXXXX)"
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
    info "$LABEL is already on the visual baseline."
  fi

  rm -f "$TMP_SOURCE"
}

# Home visual baseline: no live Home API, no shared src/home imports.
sync_ref_file \
  "mobile-overlay/src/app/(tabs)/_layout.tsx" \
  "$APP_DIR/src/app/(tabs)/_layout.tsx" \
  "Palta bottom navigation"

sync_ref_file \
  "mobile-overlay/src/app/(tabs)/home.tsx" \
  "$APP_DIR/src/app/(tabs)/home.tsx" \
  "Home tab route"

sync_ref_file \
  "mobile-overlay/src/features/home/HomeScreen.tsx" \
  "$APP_DIR/src/features/home/HomeScreen.tsx" \
  "static Home visual baseline"

sync_ref_file \
  "mobile-overlay/src/components/home/ActionSurface.tsx" \
  "$APP_DIR/src/components/home/ActionSurface.tsx" \
  "Home action surface"

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

# Keep the development API aligned with the same stable baseline so other tabs
# are not affected by stale files from a previous Home integration attempt.
sync_ref_file \
  "dev/mock-api/server.mjs" \
  "$ROOT/dev/mock-api/server.mjs" \
  "stable development API"

sync_ref_file \
  "dev/mock-api/smoke.mjs" \
  "$ROOT/dev/mock-api/smoke.mjs" \
  "stable development smoke test"

TMP_LAUNCHER="$(mktemp /tmp/palta-home-baseline-launcher.XXXXXX.sh)"
trap 'rm -f "$TMP_LAUNCHER"' EXIT
git show "$REF:scripts/run-ios-simulator-safe.sh" > "$TMP_LAUNCHER"
chmod +x "$TMP_LAUNCHER"

info "Launching stable simulator with the static Home visual baseline..."
PALTA_SIMULATOR_BRANCH="$TARGET_BRANCH" bash "$TMP_LAUNCHER"
