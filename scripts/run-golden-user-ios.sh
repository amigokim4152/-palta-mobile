#!/usr/bin/env bash
set -euo pipefail

EMAIL="${1:-${GOLDEN_USER_EMAIL:-}}"

if [ -z "$EMAIL" ] && [ -t 0 ]; then
  printf 'Golden User 001 테스트 이메일: '
  IFS= read -r EMAIL
fi

if [ -z "$EMAIL" ]; then
  echo "Usage: npm run test:golden:ios -- test@example.com" >&2
  exit 2
fi

case "$EMAIL" in
  *@*.*) ;;
  *)
    echo "FAIL: Golden User test email is invalid: $EMAIL" >&2
    exit 2
    ;;
esac

export PALTA_RUNTIME_MODE="gate01_auth"
export EXPO_PUBLIC_ENV="development"
export EXPO_PUBLIC_PALTA_ENTRY_MODE="auth_qa"
export EXPO_PUBLIC_GOLDEN_USER_EMAIL="$EMAIL"

echo "[Golden User 001] Gate 01 Auth-isolated runtime enabled."
echo "[Golden User 001] Real palta-dev email Magic Link flow will be used."
echo "[Golden User 001] No password or admin/service-role credential is used by the mobile runtime."

exec bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-ios-mobile.sh"
