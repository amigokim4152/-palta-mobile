#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "FAIL: run inside palta-mobile" >&2; exit 1; }

WRANGLER_VERSION="${PALTA_WRANGLER_VERSION:-4.133.0}"
BUCKET="${PALTA_MAP_BUCKET:-palta-data}"
EDGE_BASE="${PALTA_MAP_PRODUCTION_BASE:-https://palta-map-edge.kimeuisin.workers.dev}"
EDGE_CONFIG="$ROOT/infra/cloudflare/wrangler.map-production.jsonc"
BUSINESS_SNAPSHOT="${1:-${PALTA_BUSINESS_SNAPSHOT:-$HOME/palta-data/work/collected/business_poi/mobile-api.json}}"
PLACE_SNAPSHOT="${2:-${PALTA_LOCAL_PLACE_SNAPSHOT:-$HOME/palta-data/work/collected/local_places/mobile-api.json}}"
BUSINESS_CURRENT_KEY="palta/cl/local-business/current/businesses.json"
PLACE_CURRENT_KEY="palta/cl/local-place/current/places.json"

info() { echo "[Palta Local Data] $1"; }
fail() { echo "FAIL: $1" >&2; exit 1; }

for cmd in node npx curl shasum mktemp; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

[ -f "$BUSINESS_SNAPSHOT" ] || fail "Business snapshot not found: $BUSINESS_SNAPSHOT"
[ -f "$PLACE_SNAPSHOT" ] || fail "Local Place snapshot not found: $PLACE_SNAPSHOT"

validate_snapshot() {
  local file="$1"
  local schema="$2"
  local entity_type="$3"
  node - "$file" "$schema" "$entity_type" <<'NODE'
const fs = require('fs');
const [path, schema, entityType] = process.argv.slice(2);
const value = JSON.parse(fs.readFileSync(path, 'utf8'));
if (value?.schema_version !== schema) throw new Error(`Unexpected schema: ${value?.schema_version}`);
if (value?.dataset_class !== 'production') throw new Error('Snapshot is not production');
if (!Array.isArray(value.items) || value.items.length === 0) throw new Error('Snapshot has no items');
const ids = new Set();
for (const item of value.items) {
  if (item?.record_class !== 'production') throw new Error(`Non-production item: ${item?.id ?? 'unknown'}`);
  if (item?.entity_type !== entityType) throw new Error(`Unexpected entity type for ${item?.id}: ${item?.entity_type}`);
  if (!item.id || !item.name) throw new Error('Item missing id/name');
  if (ids.has(item.id)) throw new Error(`Duplicate canonical ID: ${item.id}`);
  ids.add(item.id);
  if (item.map_eligible === true && (!Number.isFinite(item?.location?.lat) || !Number.isFinite(item?.location?.lng))) {
    throw new Error(`Map-eligible item missing coordinates: ${item.id}`);
  }
}
process.stdout.write(String(value.items.length));
NODE
}

upload_snapshot() {
  local file="$1"
  local immutable_key="$2"
  local current_key="$3"
  npx --yes "wrangler@${WRANGLER_VERSION}" r2 object put \
    "$BUCKET/$immutable_key" --remote --file "$file" \
    --content-type "application/json; charset=utf-8" \
    --cache-control "public, max-age=31536000, immutable"
  npx --yes "wrangler@${WRANGLER_VERSION}" r2 object put \
    "$BUCKET/$current_key" --remote --file "$file" \
    --content-type "application/json; charset=utf-8" \
    --cache-control "public, max-age=60, s-maxage=300"
}

info "Validating Business and Local Place production snapshots"
BUSINESS_COUNT="$(validate_snapshot "$BUSINESS_SNAPSHOT" 'palta-business-mobile-api.v1' 'business')"
PLACE_COUNT="$(validate_snapshot "$PLACE_SNAPSHOT" 'palta-local-place-mobile-api.v1' 'place')"

BUSINESS_SHA="$(shasum -a 256 "$BUSINESS_SNAPSHOT" | awk '{print $1}')"
PLACE_SHA="$(shasum -a 256 "$PLACE_SNAPSHOT" | awk '{print $1}')"
BUSINESS_IMMUTABLE="palta/cl/local-business/versions/${BUSINESS_SHA:0:16}/businesses.json"
PLACE_IMMUTABLE="palta/cl/local-place/versions/${PLACE_SHA:0:16}/places.json"

info "Uploading $BUSINESS_COUNT businesses"
upload_snapshot "$BUSINESS_SNAPSHOT" "$BUSINESS_IMMUTABLE" "$BUSINESS_CURRENT_KEY"
info "Uploading $PLACE_COUNT Local Places"
upload_snapshot "$PLACE_SNAPSHOT" "$PLACE_IMMUTABLE" "$PLACE_CURRENT_KEY"

info "Deploying Palta Map Edge with unified Local Search"
npx --yes "wrangler@${WRANGLER_VERSION}" deploy --config "$EDGE_CONFIG"

info "Waiting for unified Local Search API"
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
if (!value.items.some((item) => item.entity_type === 'business')) process.exit(1);
if (!value.items.some((item) => item.entity_type === 'place')) process.exit(1);
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
[ "$READY" -eq 1 ] || fail "Unified Local Search did not become ready with both entity types."

info "Verifying canonical Business detail"
curl -fsS "$EDGE_BASE/v1/business/cl-rm-vitacura-starbucks-lo-curro-6666" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s);if(x.id!=="cl-rm-vitacura-starbucks-lo-curro-6666"||x.record_class!=="production")process.exit(1)})'

info "Verifying canonical Local Place detail"
curl -fsS "$EDGE_BASE/v1/place/cl-rm-vitacura-school-la-maisonnette-6076" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const x=JSON.parse(s);if(x.id!=="cl-rm-vitacura-school-la-maisonnette-6076"||x.entity_type!=="place"||x.record_class!=="production")process.exit(1)})'

info "SUCCESS: $BUSINESS_COUNT businesses + $PLACE_COUNT Local Places published."
info "Business immutable: $BUSINESS_IMMUTABLE"
info "Place immutable:    $PLACE_IMMUTABLE"
