#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel)"
TARGET_BRANCH="integration/local-business-v1"
REMOTE_NAME="${PALTA_REMOTE_NAME:-origin}"
POLL_SECONDS="${PALTA_REMOTE_POLL_SECONDS:-3}"

info() {
  echo "[Palta live] $1"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

cd "$ROOT"

CURRENT_BRANCH="$(git branch --show-current)"
[ "$CURRENT_BRANCH" = "$TARGET_BRANCH" ] || fail "Run this on $TARGET_BRANCH (current: ${CURRENT_BRANCH:-detached})."

command -v node >/dev/null 2>&1 || fail "node is required"
command -v git >/dev/null 2>&1 || fail "git is required"

REMOTE_REF="$REMOTE_NAME/$TARGET_BRANCH"
REMOTE_DEST="refs/remotes/$REMOTE_NAME/$TARGET_BRANCH"

safe_fast_forward_loop() {
  while true; do
    # Use an explicit destination ref so REMOTE_REF is guaranteed to represent
    # the just-fetched branch instead of relying on FETCH_HEAD semantics.
    if git fetch --quiet "$REMOTE_NAME" "$TARGET_BRANCH:$REMOTE_DEST"; then
      LOCAL_SHA="$(git rev-parse HEAD)"
      REMOTE_SHA="$(git rev-parse "$REMOTE_REF")"

      if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
        if ! git diff --quiet || ! git diff --cached --quiet; then
          info "Remote changed, but tracked local edits exist. Skipping auto fast-forward."
        elif git merge-base --is-ancestor "$LOCAL_SHA" "$REMOTE_SHA"; then
          info "Fast-forwarding to ${REMOTE_SHA:0:12}..."
          git merge --ff-only --quiet "$REMOTE_REF"
          info "Branch updated. Expo should refresh after overlay sync."
        else
          info "Local and remote branches diverged. Auto fast-forward skipped."
        fi
      fi
    else
      info "Remote fetch failed; keeping the current simulator session alive."
    fi

    sleep "$POLL_SECONDS"
  done
}

cleanup() {
  if [ -n "${REMOTE_WATCH_PID:-}" ]; then
    kill "$REMOTE_WATCH_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

info "Watching $REMOTE_REF every ${POLL_SECONDS}s."
safe_fast_forward_loop &
REMOTE_WATCH_PID=$!

info "Watching mobile-overlay/src and materializing changes into apps/mobile/src."
info "Keep the existing Expo/Simulator session running; Fast Refresh will pick up synced UI changes."
node "$ROOT/scripts/sync-mobile-runtime.mjs" --watch
