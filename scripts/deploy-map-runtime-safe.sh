#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="${PALTA_MAP_BRANCH:-integration/map-runtime-v1}"
WORKER_BASE="${PALTA_MAP_WORKER_BASE:-https://palta-edge-preflight.kimeuisin.workers.dev}"
MOCK_PORT="${PALTA_MOCK_PORT:-8787}"
METRO_PORT="${PALTA_METRO_PORT:-8081}"

fail() {
  echo "FAIL: $1" >&2
  exit "${2:-1}"
}

info() {
  echo "[Palta Map] $1"
}

for cmd in git node npm npx curl lsof mktemp; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || fail "Run this from inside the Palta git repository."
APP_DIR="$ROOT/apps/mobile"
[ -f "$APP_DIR/package.json" ] || fail "Existing mobile app not found at $APP_DIR."

cd "$ROOT"
info "Fetching map runtime branch without changing your current branch..."
git fetch origin "$TARGET_BRANCH:refs/remotes/origin/$TARGET_BRANCH" >/dev/null
REF="origin/$TARGET_BRANCH"
git rev-parse --verify "$REF" >/dev/null 2>&1 || fail "Cannot resolve $REF."

TMP_DIR="$(mktemp -d /tmp/palta-map-runtime.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT
mkdir -p "$TMP_DIR/infra/cloudflare/src" "$TMP_DIR/infra/cloudflare/scripts"

git show "$REF:infra/cloudflare/src/index.ts" > "$TMP_DIR/infra/cloudflare/src/index.ts"
git show "$REF:infra/cloudflare/wrangler.map-runtime.jsonc" > "$TMP_DIR/infra/cloudflare/wrangler.map-runtime.jsonc"
git show "$REF:infra/cloudflare/scripts/verify-map-range.mjs" > "$TMP_DIR/infra/cloudflare/scripts/verify-map-range.mjs"

info "Deploying style.json support to the existing palta-edge-preflight Worker..."
(
  cd "$TMP_DIR/infra/cloudflare"
  npx --yes wrangler@4.133.0 deploy --config wrangler.map-runtime.jsonc
)

info "Verifying deployed MapLibre style and PMTiles byte ranges..."
node "$TMP_DIR/infra/cloudflare/scripts/verify-map-range.mjs" "$WORKER_BASE"

STYLE_URL="$WORKER_BASE/maps/style.json"
info "Map style verified: $STYLE_URL"

# Persist Expo public runtime configuration. Shell-only exports can be lost
# when Metro is restarted from another terminal, which leaves Barrio showing
# the EXPO_PUBLIC_MAP_STYLE_URL placeholder.
ENV_LOCAL="$APP_DIR/.env.local"
cat > "$ENV_LOCAL" <<EOF
EXPO_PUBLIC_PALTA_API_BASE_URL=http://127.0.0.1:${MOCK_PORT}
EXPO_PUBLIC_ENV=development
EXPO_PUBLIC_MAP_STYLE_URL=${STYLE_URL}
EOF

if ! grep -q "^EXPO_PUBLIC_MAP_STYLE_URL=${STYLE_URL}$" "$ENV_LOCAL"; then
  fail "Map style URL was not persisted to $ENV_LOCAL."
fi
info "Persisted Expo map runtime to $ENV_LOCAL"

if lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
  info "Palta mock API is already running on port $MOCK_PORT."
else
  info "Starting Palta mock API on port $MOCK_PORT..."
  PALTA_MOCK_PORT="$MOCK_PORT" nohup node "$ROOT/dev/mock-api/server.mjs" >/tmp/palta-mock-api.log 2>&1 &
  echo $! >/tmp/palta-mock-api.pid
  sleep 1
  lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t >/dev/null 2>&1 \
    || fail "Mock API did not start. See /tmp/palta-mock-api.log"
fi

# Stop the old Metro so the next bundle is created from .env.local.
METRO_PIDS="$(lsof -nP -iTCP:"$METRO_PORT" -sTCP:LISTEN -t 2>/dev/null || true)"
if [ -n "$METRO_PIDS" ]; then
  info "Stopping old Metro on port $METRO_PORT..."
  for pid in $METRO_PIDS; do
    kill "$pid" 2>/dev/null || true
  done
  sleep 1
fi

export EXPO_PUBLIC_PALTA_API_BASE_URL="http://127.0.0.1:${MOCK_PORT}"
export EXPO_PUBLIC_ENV="development"
export EXPO_PUBLIC_MAP_STYLE_URL="$STYLE_URL"

info "Starting Palta with persistent map configuration. Keep this terminal open."
cd "$APP_DIR"
exec npx expo start --dev-client --clear --ios --port "$METRO_PORT"
