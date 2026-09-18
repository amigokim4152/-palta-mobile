#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT" ]; then
  echo "FAIL: run this from inside the Palta repository." >&2
  exit 1
fi

MAP_FILE="${PALTA_CHILE_MAP_FILE:-/Users/user/palta-data/work/maps/chile/basemap.pmtiles}"
VERSION="${PALTA_MAP_VERSION:-2026.09.17.1}"
BUCKET="${PALTA_MAP_BUCKET:-palta-data}"
OBJECT_KEY="palta/cl/maps/basemap/versions/${VERSION}/basemap.pmtiles"
UPLOADER_BASE_OVERRIDE="${PALTA_MAP_UPLOADER_BASE:-}"
PRODUCTION_BASE_OVERRIDE="${PALTA_MAP_PRODUCTION_BASE:-}"
WRANGLER_VERSION="${PALTA_WRANGLER_VERSION:-4.133.0}"
PART_SIZE_BYTES="${PALTA_MAP_PART_SIZE_BYTES:-52428800}"
UPLOADER_CONFIG="$ROOT/infra/cloudflare/wrangler.map-uploader.jsonc"
PRODUCTION_CONFIG="$ROOT/infra/cloudflare/wrangler.map-production.jsonc"
VERIFY_SCRIPT="$ROOT/infra/cloudflare/scripts/verify-map-range.mjs"

fail() {
  echo "FAIL: $1" >&2
  exit "${2:-1}"
}

info() {
  echo "[Palta Map Production] $1"
}

for cmd in git node npm npx curl python3 openssl shasum dd stat mktemp grep tail tee sleep cat; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

[ -f "$MAP_FILE" ] || fail "Chile basemap not found: $MAP_FILE"
[ -f "$UPLOADER_CONFIG" ] || fail "Missing uploader config: $UPLOADER_CONFIG"
[ -f "$PRODUCTION_CONFIG" ] || fail "Missing production config: $PRODUCTION_CONFIG"
[ -f "$VERIFY_SCRIPT" ] || fail "Missing verification script: $VERIFY_SCRIPT"

MAGIC="$(dd if="$MAP_FILE" bs=1 count=7 2>/dev/null || true)"
[ "$MAGIC" = "PMTiles" ] || fail "Not a PMTiles file: $MAP_FILE"

FILE_SIZE="$(stat -f%z "$MAP_FILE" 2>/dev/null || stat -c%s "$MAP_FILE")"
SHA256="$(shasum -a 256 "$MAP_FILE" | awk '{print $1}')"
PART_COUNT=$(( (FILE_SIZE + PART_SIZE_BYTES - 1) / PART_SIZE_BYTES ))

info "Source: $MAP_FILE"
info "Version: $VERSION"
info "Size: $FILE_SIZE bytes"
info "SHA256: $SHA256"
info "R2 object: $BUCKET/$OBJECT_KEY"
info "Multipart parts: $PART_COUNT"

cd "$ROOT"
info "Checking Cloudflare authentication..."
npx --yes "wrangler@${WRANGLER_VERSION}" whoami >/dev/null

info "Ensuring R2 bucket exists: $BUCKET"
if npx --yes "wrangler@${WRANGLER_VERSION}" r2 bucket info "$BUCKET" --json >/dev/null 2>&1; then
  info "R2 bucket already exists: $BUCKET"
else
  info "Creating R2 bucket: $BUCKET"
  npx --yes "wrangler@${WRANGLER_VERSION}" r2 bucket create "$BUCKET"
fi

TOKEN="$(openssl rand -hex 32)"
TMP_DIR="$(mktemp -d /tmp/palta-map-production.XXXXXX)"
UPLOAD_ID=""
UPLOAD_COMPLETE=0
UPLOADER_DEPLOYED=0
UPLOADER_BASE=""
PRODUCTION_BASE=""

cleanup() {
  set +e
  if [ "$UPLOAD_COMPLETE" -eq 0 ] && [ -n "$UPLOAD_ID" ] && [ "$UPLOADER_DEPLOYED" -eq 1 ] && [ -n "$UPLOADER_BASE" ]; then
    python3 - "$OBJECT_KEY" "$UPLOAD_ID" > "$TMP_DIR/abort.json" <<'PY'
import json, sys
print(json.dumps({"key": sys.argv[1], "uploadId": sys.argv[2]}))
PY
    curl -sS \
      -X POST \
      -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      --data-binary "@$TMP_DIR/abort.json" \
      "$UPLOADER_BASE/abort" >/dev/null 2>&1 || true
  fi

  if [ "$UPLOADER_DEPLOYED" -eq 1 ]; then
    printf 'y\n' | npx --yes "wrangler@${WRANGLER_VERSION}" delete \
      --config "$UPLOADER_CONFIG" \
      --name palta-map-uploader >/dev/null 2>&1 || true
  fi

  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

info "Deploying temporary authenticated multipart uploader..."
DEPLOY_LOG="$TMP_DIR/uploader-deploy.log"
npx --yes "wrangler@${WRANGLER_VERSION}" deploy \
  --config "$UPLOADER_CONFIG" \
  --var "UPLOAD_TOKEN:$TOKEN" 2>&1 | tee "$DEPLOY_LOG"
UPLOADER_DEPLOYED=1

if [ -n "$UPLOADER_BASE_OVERRIDE" ]; then
  UPLOADER_BASE="${UPLOADER_BASE_OVERRIDE%/}"
else
  UPLOADER_BASE="$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | tail -1 || true)"
fi
[ -n "$UPLOADER_BASE" ] || fail "Could not discover deployed uploader URL from Wrangler output."
info "Uploader endpoint: $UPLOADER_BASE"

info "Waiting for uploader readiness..."
READY=0
for ATTEMPT in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  HEALTH_BODY="$TMP_DIR/health-${ATTEMPT}.json"
  HEALTH_CODE="$(curl -sS -o "$HEALTH_BODY" -w '%{http_code}' "$UPLOADER_BASE/health" || true)"
  if [ "$HEALTH_CODE" = "200" ]; then
    if python3 - "$HEALTH_BODY" <<'PY'
import json, sys
try:
    with open(sys.argv[1], encoding='utf-8') as f:
        data = json.load(f)
except Exception:
    raise SystemExit(1)
raise SystemExit(0 if data.get('ok') and data.get('service') == 'palta-map-uploader' else 1)
PY
    then
      READY=1
      break
    fi
  fi
  info "Uploader not ready yet (attempt $ATTEMPT/15, HTTP ${HEALTH_CODE:-network-error}); retrying..."
  sleep 2
done

if [ "$READY" -ne 1 ]; then
  echo "Last uploader health response:" >&2
  cat "$TMP_DIR/health-15.json" >&2 2>/dev/null || true
  fail "Temporary uploader did not become ready at $UPLOADER_BASE"
fi
info "Uploader is ready."

python3 - "$OBJECT_KEY" "$SHA256" "$FILE_SIZE" > "$TMP_DIR/start.json" <<'PY'
import json, sys
print(json.dumps({
    "key": sys.argv[1],
    "sha256": sys.argv[2],
    "size": int(sys.argv[3]),
}))
PY

info "Starting R2 multipart upload..."
START_CODE="$(curl -sS \
  -o "$TMP_DIR/start-response.json" \
  -w '%{http_code}' \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/start.json" \
  "$UPLOADER_BASE/start" || true)"

if [ "$START_CODE" != "200" ]; then
  echo "Uploader /start response (HTTP $START_CODE):" >&2
  cat "$TMP_DIR/start-response.json" >&2 2>/dev/null || true
  echo >&2
  fail "Could not start R2 multipart upload."
fi

UPLOAD_ID="$(python3 - "$TMP_DIR/start-response.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    data = json.load(f)
if not data.get('ok') or not data.get('uploadId'):
    raise SystemExit('Uploader did not return uploadId: ' + repr(data))
print(data['uploadId'])
PY
)"

: > "$TMP_DIR/parts.jsonl"
PART=1
while [ "$PART" -le "$PART_COUNT" ]; do
  info "Uploading part $PART/$PART_COUNT..."
  RESPONSE_FILE="$TMP_DIR/part-${PART}.json"
  HTTP_FILE="$TMP_DIR/part-${PART}.http"

  set +e
  dd if="$MAP_FILE" bs="$PART_SIZE_BYTES" skip=$((PART - 1)) count=1 2>/dev/null \
    | curl -sS \
        -o "$RESPONSE_FILE" \
        -w '%{http_code}' \
        -X PUT \
        -H "Authorization: Bearer $TOKEN" \
        -H "X-Palta-Key: $OBJECT_KEY" \
        -H "X-Palta-Upload-Id: $UPLOAD_ID" \
        -H "X-Palta-Part-Number: $PART" \
        -H 'Content-Type: application/octet-stream' \
        --data-binary @- \
        "$UPLOADER_BASE/part" > "$HTTP_FILE"
  PIPE_STATUS=$?
  set -e

  PART_CODE="$(cat "$HTTP_FILE" 2>/dev/null || true)"
  if [ "$PIPE_STATUS" -ne 0 ] || [ "$PART_CODE" != "200" ]; then
    echo "Part $PART response (HTTP ${PART_CODE:-network-error}):" >&2
    cat "$RESPONSE_FILE" >&2 2>/dev/null || true
    echo >&2
    fail "Part $PART upload failed."
  fi

  python3 - "$RESPONSE_FILE" "$PART" >> "$TMP_DIR/parts.jsonl" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    data = json.load(f)
expected = int(sys.argv[2])
if not data.get('ok') or data.get('partNumber') != expected or not data.get('etag'):
    raise SystemExit('Invalid part response: ' + repr(data))
print(json.dumps({"partNumber": data["partNumber"], "etag": data["etag"]}))
PY

  PART=$((PART + 1))
done

python3 - "$OBJECT_KEY" "$UPLOAD_ID" "$TMP_DIR/parts.jsonl" > "$TMP_DIR/complete.json" <<'PY'
import json, sys
key, upload_id, path = sys.argv[1:]
with open(path, encoding='utf-8') as f:
    parts = [json.loads(line) for line in f if line.strip()]
print(json.dumps({"key": key, "uploadId": upload_id, "parts": parts}))
PY

info "Completing R2 multipart upload..."
COMPLETE_CODE="$(curl -sS \
  -o "$TMP_DIR/complete-response.json" \
  -w '%{http_code}' \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary "@$TMP_DIR/complete.json" \
  "$UPLOADER_BASE/complete" || true)"

if [ "$COMPLETE_CODE" != "200" ]; then
  echo "Uploader /complete response (HTTP $COMPLETE_CODE):" >&2
  cat "$TMP_DIR/complete-response.json" >&2 2>/dev/null || true
  echo >&2
  fail "Multipart completion failed."
fi

python3 - "$TMP_DIR/complete-response.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding='utf-8') as f:
    data = json.load(f)
if not data.get('ok'):
    raise SystemExit('Multipart completion failed: ' + repr(data))
PY
UPLOAD_COMPLETE=1
UPLOAD_ID=""

info "Deploying production map edge with the new immutable version..."
PRODUCTION_DEPLOY_LOG="$TMP_DIR/production-deploy.log"
npx --yes "wrangler@${WRANGLER_VERSION}" deploy \
  --config "$PRODUCTION_CONFIG" \
  --var "MAP_VERSION:$VERSION" \
  --var "MAP_OBJECT_KEY:$OBJECT_KEY" 2>&1 | tee "$PRODUCTION_DEPLOY_LOG"

if [ -n "$PRODUCTION_BASE_OVERRIDE" ]; then
  PRODUCTION_BASE="${PRODUCTION_BASE_OVERRIDE%/}"
else
  PRODUCTION_BASE="$(grep -Eo 'https://[A-Za-z0-9.-]+\.workers\.dev' "$PRODUCTION_DEPLOY_LOG" | tail -1 || true)"
fi
[ -n "$PRODUCTION_BASE" ] || fail "Could not discover production map URL from Wrangler output."
info "Production map endpoint: $PRODUCTION_BASE"

info "Waiting for production map edge readiness..."
PRODUCTION_READY=0
for ATTEMPT in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  PROD_HEALTH_BODY="$TMP_DIR/prod-health-${ATTEMPT}.json"
  PROD_HEALTH_CODE="$(curl -sS -o "$PROD_HEALTH_BODY" -w '%{http_code}' "$PRODUCTION_BASE/health" || true)"
  if [ "$PROD_HEALTH_CODE" = "200" ]; then
    if python3 - "$PROD_HEALTH_BODY" "$VERSION" "$OBJECT_KEY" <<'PY'
import json, sys
path, version, object_key = sys.argv[1:]
try:
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
except Exception:
    raise SystemExit(1)
ok = (
    data.get('ok')
    and data.get('service') == 'palta-map-edge'
    and data.get('country') == 'CL'
    and data.get('mapVersion') == version
    and data.get('mapObjectKey') == object_key
)
raise SystemExit(0 if ok else 1)
PY
    then
      PRODUCTION_READY=1
      break
    fi
  fi
  info "Production edge not ready yet (attempt $ATTEMPT/15, HTTP ${PROD_HEALTH_CODE:-network-error}); retrying..."
  sleep 2
done

if [ "$PRODUCTION_READY" -ne 1 ]; then
  echo "Last production health response:" >&2
  cat "$TMP_DIR/prod-health-15.json" >&2 2>/dev/null || true
  fail "Production map edge did not become ready at $PRODUCTION_BASE"
fi
info "Production map edge is ready."

info "Verifying manifest, style, PMTiles header and HTTP Range behavior..."
node "$VERIFY_SCRIPT" "$PRODUCTION_BASE"

RELEASE_FILE="$(dirname "$MAP_FILE")/release-${VERSION}.json"
python3 - "$RELEASE_FILE" "$VERSION" "$FILE_SIZE" "$SHA256" "$BUCKET" "$OBJECT_KEY" "$PRODUCTION_BASE" <<'PY'
import json, sys
path, version, size, sha256, bucket, key, base = sys.argv[1:]
value = {
    "schema_version": 1,
    "country": "CL",
    "version": version,
    "size_bytes": int(size),
    "sha256": sha256,
    "r2_bucket": bucket,
    "r2_object_key": key,
    "production_base": base,
    "manifest_url": base.rstrip('/') + "/maps/cl/manifest.json",
    "style_url": base.rstrip('/') + "/maps/cl/style.json",
    "pmtiles_url": base.rstrip('/') + "/maps/cl/basemap.pmtiles",
}
with open(path, 'w', encoding='utf-8') as f:
    json.dump(value, f, ensure_ascii=False, indent=2)
    f.write('\n')
print(path)
PY

info "SUCCESS: Chile-wide Palta basemap promoted to production."
info "R2 bucket: $BUCKET"
info "Manifest: $PRODUCTION_BASE/maps/cl/manifest.json"
info "Style: $PRODUCTION_BASE/maps/cl/style.json"
info "Map: $PRODUCTION_BASE/maps/cl/basemap.pmtiles"
info "Release metadata: $RELEASE_FILE"
