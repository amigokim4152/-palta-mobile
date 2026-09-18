#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "FAIL: run inside palta-mobile" >&2; exit 1; }

WRANGLER_VERSION="${PALTA_WRANGLER_VERSION:-4.133.0}"
BUCKET="${PALTA_MAP_BUCKET:-palta-data}"
EDGE_BASE="${PALTA_MAP_PRODUCTION_BASE:-https://palta-map-edge.kimeuisin.workers.dev}"
EDGE_CONFIG="$ROOT/infra/cloudflare/wrangler.map-production.jsonc"
DEFAULT_SNAPSHOT="$HOME/palta-data/work/collected/business_poi/mobile-api.json"
SNAPSHOT="${1:-${PALTA_BUSINESS_SNAPSHOT:-$DEFAULT_SNAPSHOT}}"
CURRENT_KEY="palta/cl/local-business/current/businesses.json"

info() { echo "[Palta Local Business] $1"; }
fail() { echo "FAIL: $1" >&2; exit 1; }

for cmd in node npx curl shasum mktemp; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

[ -f "$SNAPSHOT" ] || fail "Business snapshot not found: $SNAPSHOT. Run palta-engine business-poi first."

info "Validating production snapshot: $SNAPSHOT"
RECORD_COUNT="$(node - "$SNAPSHOT" <<'NODE'
const fs = require('fs');
const path = process.argv[2];
const value = JSON.parse(fs.readFileSync(path, 'utf8'));
if (value?.schema_version !== 'palta-business-mobile-api.v1') {
  throw new Error(`Unexpected schema: ${value?.schema_version}`);
}
if (!Array.isArray(value.items) || value.items.length === 0) {
  throw new Error('Snapshot has no items');
}
const ids = new Set();
for (const item of value.items) {
  if (item?.record_class !== 'production') {
    throw new Error(`Non-production item refused: ${item?.id ?? 'unknown'}`);
  }
  if (!item.id || !item.name) throw new Error('Item missing id/name');
  if (ids.has(item.id)) throw new Error(`Duplicate canonical ID: ${item.id}`);
  ids.add(item.id);
  if (item.map_eligible === true) {
    if (!Number.isFinite(item?.location?.lat) || !Number.isFinite(item?.location?.lng)) {
      throw new Error(`Map-eligible item missing coordinates: ${item.id}`);
    }
  }
}
process.stdout.write(String(value.items.length));
NODE
)"

SHA256="$(shasum -a 256 "$SNAPSHOT" | awk '{print $1}')"
IMMUTABLE_KEY="palta/cl/local-business/versions/${SHA256:0:16}/businesses.json"

info "Uploading immutable snapshot ($RECORD_COUNT records)"
npx --yes "wrangler@${WRANGLER_VERSION}" r2 object put \
  "$BUCKET/$IMMUTABLE_KEY" \
  --remote \
  --file "$SNAPSHOT" \
  --content-type "application/json; charset=utf-8" \
  --cache-control "public, max-age=31536000, immutable"

info "Promoting immutable snapshot to current"
npx --yes "wrangler@${WRANGLER_VERSION}" r2 object put \
  "$BUCKET/$CURRENT_KEY" \
  --remote \
  --file "$SNAPSHOT" \
  --content-type "application/json; charset=utf-8" \
  --cache-control "public, max-age=60, s-maxage=300"

info "Deploying Palta Map Edge with Local Business API"
npx --yes "wrangler@${WRANGLER_VERSION}" deploy \
  --config "$EDGE_CONFIG"

info "Waiting for Local Business API"
READY=0
for ATTEMPT in 1 2 3 4 5 6 7 8 9 10 11 12; do
  TMP="$(mktemp)"
  STATUS="$(curl -sS -o "$TMP" -w '%{http_code}' \
    "$EDGE_BASE/v1/local/search?lat=-33.3842&lng=-70.5742&radius_m=5000" || true)"
  if [ "$STATUS" = "200" ] && node - "$TMP" <<'NODE' >/dev/null 2>&1
const fs = require('fs');
const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!Array.isArray(value.items) || value.items.length < 1) process.exit(1);
if (value.items.some((item) => item.record_class !== 'production')) process.exit(1);
NODE
  then
    READY=1
    rm -f "$TMP"
    break
  fi
  rm -f "$TMP"
  info "API not ready yet ($ATTEMPT/12); retrying..."
  sleep 2
done

[ "$READY" -eq 1 ] || fail "Local Business API did not become ready with production data."

info "Verifying canonical business detail"
DETAIL_STATUS="$(curl -sS -o /tmp/palta-business-detail.json -w '%{http_code}' \
  "$EDGE_BASE/v1/business/cl-rm-vitacura-starbucks-lo-curro-6666" || true)"
[ "$DETAIL_STATUS" = "200" ] || fail "Canonical business detail returned HTTP $DETAIL_STATUS"
node - /tmp/palta-business-detail.json <<'NODE'
const fs = require('fs');
const item = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (item.id !== 'cl-rm-vitacura-starbucks-lo-curro-6666') {
  throw new Error('Canonical detail returned the wrong business');
}
if (item.record_class !== 'production') {
  throw new Error('Canonical detail is not production data');
}
NODE
rm -f /tmp/palta-business-detail.json

info "SUCCESS: $RECORD_COUNT production businesses published."
info "Immutable: $IMMUTABLE_KEY"
info "Current:   $CURRENT_KEY"
