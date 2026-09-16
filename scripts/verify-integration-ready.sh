#!/usr/bin/env bash
set -u

failures=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "PASS $label"
  else
    echo "FAIL $label"
    failures=$((failures+1))
  fi
}

check "git repo" git rev-parse --is-inside-work-tree
check "node" node --version
check "npm" npm --version
check "npx" npx --version

branch="$(git branch --show-current 2>/dev/null || true)"
if [[ "$branch" == integration/* ]]; then
  echo "PASS integration branch: $branch"
else
  echo "FAIL integration branch: $branch"
  failures=$((failures+1))
fi

if [ -z "$(git status --porcelain 2>/dev/null)" ]; then
  echo "PASS clean working tree"
else
  echo "FAIL dirty working tree"
  git status --short || true
  failures=$((failures+1))
fi

if [ -f package.json ]; then
  if npm run verify >/dev/null 2>&1; then
    echo "PASS Palta verify"
  else
    echo "FAIL Palta verify"
    failures=$((failures+1))
  fi
else
  echo "NOT VERIFIED root package.json absent"
fi

echo
if [ "$failures" -eq 0 ]; then
  echo "READY_FOR_INTEGRATION"
  exit 0
else
  echo "BLOCKED failures=$failures"
  exit 1
fi
