#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "FAIL: run inside the Palta repository" >&2; exit 1; }

WRANGLER_VERSION="${PALTA_WRANGLER_VERSION:-4.133.0}"
PRODUCTION_CONFIG="$ROOT/infra/cloudflare/wrangler.map-production.jsonc"
VERIFY_SCRIPT="$ROOT/infra/cloudflare/scripts/verify-map-range.mjs"
PRODUCTION_BASE="${PALTA_MAP_PRODUCTION_BASE:-https://palta-map-edge.kimeuisin.workers.dev}"
VERSION="${PALTA_MAP_VERSION:-2026.09.17.1}"
OBJECT_KEY="${PALTA_MAP_OBJECT_KEY:-palta/cl/maps/basemap/versions/${VERSION}/basemap.pmtiles}"

info() { echo "[Palta Map Edge] $1"; }
fail() { echo "FAIL: $1" >&2; exit 1; }

for cmd in npx node curl sleep; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

info "Deploying Worker only; existing PMTiles in palta-data will be reused."
npx --yes "wrangler@${WRANGLER_VERSION}" deploy \
  --config "$PRODUCTION_CONFIG" \
  --var "MAP_VERSION:$VERSION" \
  --var "MAP_OBJECT_KEY:$OBJECT_KEY"

info "Waiting for production edge readiness..."
READY=0
for ATTEMPT in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if BODY="$(curl -fsS "$PRODUCTION_BASE/health" 2>/dev/null)"; then
    if printf '%s' "$BODY" | grep -q '"service":"palta-map-edge"' \
      && printf '%s' "$BODY" | grep -q "\"mapVersion\":\"$VERSION\""; then
      READY=1
      break
    fi
  fi
  info "Not ready yet ($ATTEMPT/15); retrying..."
  sleep 2
done

[ "$READY" -eq 1 ] || fail "Production map edge did not become ready."

info "Running live manifest/style/PMTiles Range verification..."
node "$VERIFY_SCRIPT" "$PRODUCTION_BASE"

info "SUCCESS: Palta Chile Map Edge verified using existing palta-data PMTiles."
