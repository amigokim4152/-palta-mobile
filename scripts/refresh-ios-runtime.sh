#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel)"
TARGET_BRANCH="integration/runtime-composition-v1"
REMOTE_NAME="${PALTA_REMOTE_NAME:-origin}"
APP_DIR="$ROOT/apps/mobile"
BUNDLE_ID="cl.somospalta.app"

info() {
  echo "[Palta refresh] $1"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

cd "$ROOT"

CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    fail "Local tracked changes exist on $CURRENT_BRANCH. Commit/stash them before switching to $TARGET_BRANCH."
  fi
  info "Switching to $TARGET_BRANCH..."
  git switch "$TARGET_BRANCH"
fi

info "Refreshing composition and live feature refs..."
git fetch --quiet "$REMOTE_NAME" \
  "$TARGET_BRANCH:refs/remotes/$REMOTE_NAME/$TARGET_BRANCH" \
  "integration/local-business-v1:refs/remotes/$REMOTE_NAME/integration/local-business-v1" \
  "integration/market-v1:refs/remotes/$REMOTE_NAME/integration/market-v1" \
  "integration/play-discovery-v1:refs/remotes/$REMOTE_NAME/integration/play-discovery-v1"

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "$REMOTE_NAME/$TARGET_BRANCH")"
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
  if ! git diff --quiet || ! git diff --cached --quiet; then
    fail "Composition branch has local tracked changes; refusing to overwrite them."
  fi
  if git merge-base --is-ancestor "$LOCAL_SHA" "$REMOTE_SHA"; then
    info "Fast-forwarding composition to ${REMOTE_SHA:0:12}..."
    git merge --ff-only --quiet "$REMOTE_NAME/$TARGET_BRANCH"
  else
    fail "Local composition branch has diverged from remote; manual reconciliation required."
  fi
fi

info "Rebuilding generated mobile runtime from current live overlays..."
node "$ROOT/scripts/compose-mobile-runtime.mjs"

info "Clearing Expo runtime metadata..."
rm -rf "$APP_DIR/.expo"

BOOTED_UDID="$(xcrun simctl list devices booted | awk -F '[()]' '/iPhone/ && /Booted/ {print $2; exit}')"
if [ -n "$BOOTED_UDID" ]; then
  xcrun simctl terminate "$BOOTED_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
fi

info "Launching refreshed Palta on iOS Simulator..."
exec bash "$ROOT/scripts/run-ios-mobile.sh"
