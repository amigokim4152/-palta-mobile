#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "FAIL: run inside the Palta repository" >&2; exit 1; }

WRANGLER_VERSION="${PALTA_WRANGLER_VERSION:-4.133.0}"
PRODUCTION_CONFIG="$ROOT/infra/cloudflare/wrangler.map-production.jsonc"
VERIFY_SCRIPT="$ROOT/infra/cloudflare/scripts/verify-map-range.mjs"
PRODUCTION_BASE="${PALTA_MAP_PRODUCTION_BASE:-https://palta-map-edge.kimeuisin.workers.dev}"
VERSION="${PALTA_MAP_VERSION:-2026.09.17.1}"
STYLE_VERSION="${PALTA_MAP_STYLE_VERSION:-palta-v1.7}"
OBJECT_KEY="${PALTA_MAP_OBJECT_KEY:-palta/cl/maps/basemap/versions/${VERSION}/basemap.pmtiles}"
BUCKET="${PALTA_MAP_BUCKET:-palta-data}"
FONT_OBJECT_KEY="palta/cl/maps/fonts/noto-sans/1edf95b/NotoSans.ttf"
FONT_LICENSE_OBJECT_KEY="palta/cl/maps/fonts/noto-sans/1edf95b/OFL.txt"
FONT_SOURCE="https://raw.githubusercontent.com/google/fonts/1edf95b4328bc5997ca93d2c0c7205272ec7347f/ofl/notosans/NotoSans%5Bwdth%2Cwght%5D.ttf"
FONT_LICENSE_SOURCE="https://raw.githubusercontent.com/google/fonts/1edf95b4328bc5997ca93d2c0c7205272ec7347f/ofl/notosans/OFL.txt"
FONT_EXPECTED_SIZE=2049096
SYMBOL_FONT_OBJECT_KEY="palta/cl/maps/fonts/noto-sans-symbols-2/current/NotoSansSymbols2-Regular.ttf"
SYMBOL_FONT_LICENSE_OBJECT_KEY="palta/cl/maps/fonts/noto-sans-symbols-2/current/OFL.txt"
SYMBOL_FONT_SOURCE="https://notofonts.github.io/symbols/fonts/NotoSansSymbols2/hinted/ttf/NotoSansSymbols2-Regular.ttf"
SYMBOL_FONT_LICENSE_SOURCE="https://raw.githubusercontent.com/notofonts/symbols/main/OFL.txt"

info() { echo "[Palta Map Edge] $1"; }
fail() { echo "FAIL: $1" >&2; exit 1; }

for cmd in npx node curl sleep mktemp wc; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

TMP_DIR="$(mktemp -d /tmp/palta-map-edge.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT INT TERM

FONT_READY=0
if curl -fsSI "$PRODUCTION_BASE/maps/cl/fonts/NotoSans.ttf" >/dev/null 2>&1; then
  FONT_READY=1
  info "Self-hosted Noto Sans is already available from Palta Map Edge."
fi

if [ "$FONT_READY" -eq 0 ]; then
  FONT_FILE="$TMP_DIR/NotoSans.ttf"
  LICENSE_FILE="$TMP_DIR/OFL.txt"

  info "Preparing self-hosted Noto Sans for Palta labels..."
  curl -fL --retry 3 --retry-delay 1 "$FONT_SOURCE" -o "$FONT_FILE"
  curl -fL --retry 3 --retry-delay 1 "$FONT_LICENSE_SOURCE" -o "$LICENSE_FILE"

  FONT_SIZE="$(wc -c < "$FONT_FILE" | tr -d ' ')"
  [ "$FONT_SIZE" = "$FONT_EXPECTED_SIZE" ] || \
    fail "Unexpected Noto Sans size: $FONT_SIZE (expected $FONT_EXPECTED_SIZE)"
  [ -s "$LICENSE_FILE" ] || fail "Noto Sans OFL license download is empty"

  info "Uploading Noto Sans to $BUCKET/$FONT_OBJECT_KEY"
  npx --yes "wrangler@${WRANGLER_VERSION}" r2 object put \
    "$BUCKET/$FONT_OBJECT_KEY" \
    --remote \
    --file "$FONT_FILE" \
    --content-type "font/ttf" \
    --cache-control "public, max-age=31536000, immutable"

  info "Uploading Noto Sans OFL license to $BUCKET/$FONT_LICENSE_OBJECT_KEY"
  npx --yes "wrangler@${WRANGLER_VERSION}" r2 object put \
    "$BUCKET/$FONT_LICENSE_OBJECT_KEY" \
    --remote \
    --file "$LICENSE_FILE" \
    --content-type "text/plain; charset=utf-8" \
    --cache-control "public, max-age=31536000, immutable"
fi

SYMBOL_FONT_READY=0
if curl -fsSI "$PRODUCTION_BASE/maps/cl/fonts/NotoSansSymbols2.ttf" >/dev/null 2>&1; then
  SYMBOL_FONT_READY=1
  info "Self-hosted Noto Sans Symbols 2 is already available from Palta Map Edge."
fi

if [ "$SYMBOL_FONT_READY" -eq 0 ]; then
  SYMBOL_FONT_FILE="$TMP_DIR/NotoSansSymbols2-Regular.ttf"
  SYMBOL_LICENSE_FILE="$TMP_DIR/NotoSymbols-OFL.txt"

  info "Preparing Noto Sans Symbols 2 for Palta category pictograms..."
  curl -fL --retry 3 --retry-delay 1 "$SYMBOL_FONT_SOURCE" -o "$SYMBOL_FONT_FILE"
  curl -fL --retry 3 --retry-delay 1 "$SYMBOL_FONT_LICENSE_SOURCE" -o "$SYMBOL_LICENSE_FILE"

  SYMBOL_FONT_SIZE="$(wc -c < "$SYMBOL_FONT_FILE" | tr -d ' ')"
  [ "$SYMBOL_FONT_SIZE" -gt 100000 ] || \
    fail "Noto Sans Symbols 2 download is unexpectedly small: $SYMBOL_FONT_SIZE"
  [ -s "$SYMBOL_LICENSE_FILE" ] || fail "Noto Symbols OFL license download is empty"

  info "Uploading Noto Sans Symbols 2 to $BUCKET/$SYMBOL_FONT_OBJECT_KEY"
  npx --yes "wrangler@${WRANGLER_VERSION}" r2 object put \
    "$BUCKET/$SYMBOL_FONT_OBJECT_KEY" \
    --remote \
    --file "$SYMBOL_FONT_FILE" \
    --content-type "font/ttf" \
    --cache-control "public, max-age=31536000, immutable"

  info "Uploading Noto Symbols OFL license to $BUCKET/$SYMBOL_FONT_LICENSE_OBJECT_KEY"
  npx --yes "wrangler@${WRANGLER_VERSION}" r2 object put \
    "$BUCKET/$SYMBOL_FONT_LICENSE_OBJECT_KEY" \
    --remote \
    --file "$SYMBOL_LICENSE_FILE" \
    --content-type "text/plain; charset=utf-8" \
    --cache-control "public, max-age=31536000, immutable"
fi

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
      && printf '%s' "$BODY" | grep -q "\"mapVersion\":\"$VERSION\"" \
      && printf '%s' "$BODY" | grep -q "\"mapStyleVersion\":\"$STYLE_VERSION\""; then
      READY=1
      break
    fi
  fi
  info "Not ready yet ($ATTEMPT/15); retrying..."
  sleep 2
done

[ "$READY" -eq 1 ] || fail "Production map edge did not become ready with $STYLE_VERSION."

info "Running live manifest/style/font/PMTiles verification..."
PALTA_EXPECTED_MAP_STYLE_VERSION="$STYLE_VERSION" node "$VERIFY_SCRIPT" "$PRODUCTION_BASE"

info "SUCCESS: Palta Chile Map Edge verified using existing palta-data PMTiles."
