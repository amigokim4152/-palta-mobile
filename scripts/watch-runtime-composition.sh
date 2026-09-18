#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel)"
TARGET_BRANCH="integration/runtime-composition-v1"
REMOTE_NAME="${PALTA_REMOTE_NAME:-origin}"
POLL_SECONDS="${PALTA_REMOTE_POLL_SECONDS:-3}"
MANIFEST="$ROOT/manifest/mobile-runtime-composition.json"
LAST_SIGNATURE=""
LAST_SOURCE_SIGNATURE=""

info() {
  echo "[Palta runtime] $1"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

cd "$ROOT"

CURRENT_BRANCH="$(git branch --show-current)"
PREVIEW_BRANCH="integration/runtime-preview-v1"

if [ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ] && [ "$CURRENT_BRANCH" != "$PREVIEW_BRANCH" ]; then
  fail "Run this on $TARGET_BRANCH or $PREVIEW_BRANCH (current: ${CURRENT_BRANCH:-detached})."
fi

command -v node >/dev/null 2>&1 || fail "node is required"
command -v git >/dev/null 2>&1 || fail "git is required"
[ -f "$MANIFEST" ] || fail "Missing runtime composition manifest."

fetch_branch() {
  local branch="$1"
  local destination="refs/remotes/$REMOTE_NAME/$branch"
  git fetch --quiet "$REMOTE_NAME" "$branch:$destination"
}

safe_fast_forward_composition() {
  if [ "$CURRENT_BRANCH" = "$PREVIEW_BRANCH" ]; then
    return 0
  fi

  fetch_branch "$TARGET_BRANCH" || return 1
  local local_sha remote_ref remote_sha
  local_sha="$(git rev-parse HEAD)"
  remote_ref="$REMOTE_NAME/$TARGET_BRANCH"
  remote_sha="$(git rev-parse "$remote_ref")"

  [ "$local_sha" = "$remote_sha" ] && return 0

  if ! git diff --quiet || ! git diff --cached --quiet; then
    info "Composition branch changed remotely, but tracked local edits exist. Auto-update skipped."
    return 0
  fi

  if git merge-base --is-ancestor "$local_sha" "$remote_sha"; then
    info "Updating composition branch to ${remote_sha:0:12}..."
    git merge --ff-only --quiet "$remote_ref"
    info "Composition branch updated."
  else
    info "Composition branch diverged. Auto-update skipped."
  fi
}

source_branches() {
  node - "$MANIFEST" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
const branches = new Set();
for (const surface of manifest.surfaces ?? []) {
  if (typeof surface.source_branch === 'string') branches.add(surface.source_branch);
}
for (const core of manifest.core_integrations ?? []) {
  if (typeof core.source_branch === 'string') branches.add(core.source_branch);
}
for (const branch of branches) console.log(branch);
NODE
}

live_branches() {
  node - "$MANIFEST" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const surface of manifest.surfaces ?? []) {
  if (surface.integration_mode === 'live_overlay' && typeof surface.source_branch === 'string') {
    console.log(surface.source_branch);
  }
}
NODE
}

fetch_sources() {
  local branch
  local -a refspecs=()
  while IFS= read -r branch; do
    [ -n "$branch" ] || continue
    refspecs+=("$branch:refs/remotes/$REMOTE_NAME/$branch")
  done < <(source_branches)

  [ "${#refspecs[@]}" -gt 0 ] || return 0
  if ! git fetch --quiet "$REMOTE_NAME" "${refspecs[@]}"; then
    info "Could not refresh one or more runtime source branches; keeping the last composed runtime."
    return 1
  fi
}

composition_signature() {
  {
    git rev-parse HEAD
    local branch
    while IFS= read -r branch; do
      [ -n "$branch" ] || continue
      git rev-parse "$REMOTE_NAME/$branch"
    done < <(live_branches)
    shasum "$MANIFEST"
  } | shasum | awk '{print $1}'
}

source_signature() {
  {
    local branch
    while IFS= read -r branch; do
      [ -n "$branch" ] || continue
      git rev-parse "$REMOTE_NAME/$branch"
    done < <(source_branches)
    shasum "$MANIFEST"
  } | shasum | awk '{print $1}'
}

report_source_drift_if_changed() {
  local signature
  signature="$(source_signature)"
  if [ "$signature" != "$LAST_SOURCE_SIGNATURE" ]; then
    node "$ROOT/scripts/check-runtime-source-drift.mjs"
    LAST_SOURCE_SIGNATURE="$signature"
  fi
}

compose_if_changed() {
  local signature
  signature="$(composition_signature)"
  if [ "$signature" != "$LAST_SIGNATURE" ]; then
    info "Composing current mobile runtime..."
    node "$ROOT/scripts/compose-mobile-runtime.mjs"
    LAST_SIGNATURE="$signature"
    info "Runtime ready for Expo Fast Refresh."
  fi
}

info "Watching composed runtime every ${POLL_SECONDS}s."
info "Composition: $TARGET_BRANCH"

while true; do
  if safe_fast_forward_composition && fetch_sources; then
    report_source_drift_if_changed
    compose_if_changed
  fi
  sleep "$POLL_SECONDS"
done
