#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git -C "$SCRIPT_DIR/.." rev-parse --show-toplevel)"
APP_DIR="$ROOT/apps/mobile"
SUPABASE_URL="https://rqbpbauhkdgsrkbwmkmg.supabase.co"
PUBLISHABLE_KEY="sb_publishable_QEHIwvil9m4lyE6kJ1ba6w_CjA9_XXh"
GOLDEN_EMAIL="golden-user-001@somospalta.test"
LOCAL_ENV="$APP_DIR/.env.local"

fail() {
  echo "FAIL: $1" >&2
  exit "${2:-1}"
}

info() {
  echo "[Golden User 001] $1"
}

command -v node >/dev/null 2>&1 || fail "Node.js is required."
command -v npm >/dev/null 2>&1 || fail "npm is required."
[ -f "$APP_DIR/package.json" ] || fail "Mobile package not found: $APP_DIR"

SECRET_KEY="${SUPABASE_SECRET_KEY:-}"
if [ -z "$SECRET_KEY" ]; then
  printf 'Supabase secret key (sb_secret_..., 입력 내용은 화면에 표시되지 않음): '
  IFS= read -r -s SECRET_KEY
  printf '\n'
fi

[[ "$SECRET_KEY" == sb_secret_* ]] || fail "A modern Supabase sb_secret_... key is required."

# Generate a local-only synthetic password. It is intentionally never printed
# and is written only to apps/mobile/.env.local, which is gitignored.
GOLDEN_PASSWORD="$(node -e "const c=require('node:crypto'); process.stdout.write(c.randomBytes(24).toString('base64url')+'!G7')")"
[ "${#GOLDEN_PASSWORD}" -ge 20 ] || fail "Failed to generate synthetic password."

info "Provisioning the fixed synthetic Auth user through Supabase Admin API..."
SUPABASE_URL="$SUPABASE_URL" \
SUPABASE_SECRET_KEY="$SECRET_KEY" \
GOLDEN_USER_EMAIL="$GOLDEN_EMAIL" \
GOLDEN_USER_PASSWORD="$GOLDEN_PASSWORD" \
npm --prefix "$APP_DIR" run golden:provision

umask 077
cat > "$LOCAL_ENV" <<EOF
# Generated locally for Golden User 001. Gitignored; do not commit.
EXPO_PUBLIC_ENV=development
EXPO_PUBLIC_SUPABASE_URL=$SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY
EXPO_PUBLIC_ENABLE_GOLDEN_USER_AUTH=true
EXPO_PUBLIC_GOLDEN_USER_EMAIL=$GOLDEN_EMAIL
EXPO_PUBLIC_GOLDEN_USER_PASSWORD=$GOLDEN_PASSWORD
EOF
chmod 600 "$LOCAL_ENV" 2>/dev/null || true

# Do not retain the admin key longer than necessary in this process.
unset SECRET_KEY SUPABASE_SECRET_KEY

info "Golden User 001 provisioning completed."
info "Local development Auth config written to apps/mobile/.env.local (gitignored)."

if [ "${1:-}" = "--no-launch" ]; then
  info "Launch skipped by --no-launch."
  exit 0
fi

info "Launching the Palta iOS development runtime..."
exec bash "$ROOT/scripts/run-ios-mobile.sh"
