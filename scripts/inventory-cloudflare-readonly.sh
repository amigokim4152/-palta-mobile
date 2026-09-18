#!/usr/bin/env bash
set -euo pipefail

# Somos Palta Cloudflare inventory — READ ONLY
#
# Purpose:
# - discover existing account resources before creating anything
# - prevent duplicate Workers/R2/Queues/Hyperdrive resources
# - print only control-plane metadata; do not print Worker secrets
#
# This script deliberately disables Wrangler's experimental provisioning and
# auto-create behavior on every resource command.

WRANGLER=(npx wrangler)
READ_ONLY_FLAGS=(--x-provision=false --x-auto-create=false)

section() {
  printf '\n============================================================\n'
  printf '%s\n' "$1"
  printf '============================================================\n'
}

run_optional() {
  local title="$1"
  shift
  section "$title"
  if "$@"; then
    return 0
  fi
  local code=$?
  printf 'NOT VERIFIED: command exited with code %s\n' "$code"
  return 0
}

section "Wrangler version"
"${WRANGLER[@]}" --version

section "Cloudflare identity / account membership"
if ! "${WRANGLER[@]}" whoami --json; then
  echo "NOT AUTHENTICATED: run 'npx wrangler login' manually, then rerun this inventory."
  exit 2
fi

run_optional "Existing R2 buckets" \
  "${WRANGLER[@]}" r2 bucket list "${READ_ONLY_FLAGS[@]}"

run_optional "Existing Queues" \
  "${WRANGLER[@]}" queues list "${READ_ONLY_FLAGS[@]}"

run_optional "Existing Hyperdrive configurations" \
  "${WRANGLER[@]}" hyperdrive list "${READ_ONLY_FLAGS[@]}"

section "Repository-side expected Palta resources"
cat <<'EOF'
DO NOT CREATE from this script.

Existing/expected roles to reconcile with the account inventory:
- public/map edge Worker (repo template name: palta-edge-preflight)
- Commerce API Worker (repo template name: palta-commerce-api)
- payment worker
- fiscal worker
- outbox dispatcher
- existing map/data R2 bucket(s) — REUSE when already present
- DEV payment queue
- DEV fiscal queue
- DEV notification queue (only when Notification runtime is wired)
- DEV Hyperdrive config pointing to palta-dev PostgreSQL

Canonical DEV database already exists separately in Supabase.
EOF

section "Safety result"
echo "READ-ONLY INVENTORY COMPLETE. No create/update/delete command is present in this script."
