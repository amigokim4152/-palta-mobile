#!/usr/bin/env bash
set -euo pipefail

HOME_BRANCH="${PALTA_HOME_BRANCH:-integration/home-functional-foundation-v1}"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "FAIL: run inside the Palta repository" >&2; exit 1; }
cd "$ROOT"

APP_DIR="$ROOT/apps/mobile"
[ -f "$APP_DIR/package.json" ] || { echo "FAIL: apps/mobile not found" >&2; exit 1; }

git fetch origin "$HOME_BRANCH:refs/remotes/origin/$HOME_BRANCH" >/dev/null
HOME_REF="origin/$HOME_BRANCH"
git rev-parse --verify "$HOME_REF" >/dev/null 2>&1 || { echo "FAIL: cannot resolve $HOME_REF" >&2; exit 1; }

BACKUP_DIR="/tmp/palta-home-first-screen-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

sync_file() {
  SOURCE_PATH="$1"
  DEST_PATH="$2"
  LABEL="$3"
  git cat-file -e "$HOME_REF:$SOURCE_PATH" 2>/dev/null || { echo "FAIL: missing $SOURCE_PATH on $HOME_REF" >&2; exit 1; }
  mkdir -p "$(dirname "$DEST_PATH")"
  if [ -f "$DEST_PATH" ]; then
    cp "$DEST_PATH" "$BACKUP_DIR/$(printf '%s' "$DEST_PATH" | sed "s#^$APP_DIR/##" | tr '/' '_')"
  fi
  git show "$HOME_REF:$SOURCE_PATH" > "$DEST_PATH"
  echo "[Palta Home] synced $LABEL"
}

# Force the local Expo router to use the same verified Home entry path as the
# function-first Home branch. This prevents an older local tab/index route from
# hiding the latest Home screen even when HomeScreen itself is up to date.
sync_file "mobile-overlay/src/app/(tabs)/home.tsx" "$APP_DIR/src/app/(tabs)/home.tsx" "Home tab route"
sync_file "mobile-overlay/src/app/(tabs)/index.tsx" "$APP_DIR/src/app/(tabs)/index.tsx" "tab index redirect"
sync_file "mobile-overlay/src/app/(tabs)/_layout.tsx" "$APP_DIR/src/app/(tabs)/_layout.tsx" "tab layout / initial Home route"
sync_file "mobile-overlay/src/theme/paltaTheme.ts" "$APP_DIR/src/theme/paltaTheme.ts" "Palta theme"
sync_file "mobile-overlay/src/components/ScreenFrame.tsx" "$APP_DIR/src/components/ScreenFrame.tsx" "Home screen frame"
sync_file "mobile-overlay/src/accessibility/useAdaptiveExperience.ts" "$APP_DIR/src/accessibility/useAdaptiveExperience.ts" "adaptive Home layout"

TMP_RUNNER="$(mktemp /tmp/palta-home-first-screen-runner.XXXXXX.sh)"
trap 'rm -f "$TMP_RUNNER"' EXIT
git show "$HOME_REF:scripts/run-ios-simulator-safe.sh" > "$TMP_RUNNER"
chmod +x "$TMP_RUNNER"

export PALTA_HOME_BRANCH="$HOME_BRANCH"
bash "$TMP_RUNNER"
