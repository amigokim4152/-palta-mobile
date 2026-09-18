#!/usr/bin/env bash
set -u

PASS=0
WARN=0
FAIL=0

pass() { echo "PASS  $1"; PASS=$((PASS+1)); }
warn() { echo "WARN  $1"; WARN=$((WARN+1)); }
fail() { echo "FAIL  $1"; FAIL=$((FAIL+1)); }

command -v git >/dev/null 2>&1 && pass "git installed" || fail "git missing"
command -v node >/dev/null 2>&1 && pass "node installed" || fail "node missing"
command -v npm >/dev/null 2>&1 && pass "npm installed" || fail "npm missing"

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -e "process.stdout.write(process.versions.node.split('.')[0])")"
  if [ "$NODE_MAJOR" -ge 22 ]; then
    pass "Node.js >= 22 ($(node -v))"
  else
    fail "Node.js >= 22 required; found $(node -v)"
  fi
fi

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  pass "inside git repository"
  BRANCH="$(git branch --show-current 2>/dev/null || true)"
  if [ "$BRANCH" = "main" ]; then
    fail "currently on main; implementation work must stay on an integration branch"
  elif [[ "$BRANCH" == integration/* ]]; then
    pass "safe integration branch selected ($BRANCH)"
  elif [ -n "$BRANCH" ]; then
    warn "current branch is '$BRANCH'; verify before modifying files"
  else
    warn "detached HEAD; verify the target ref before modifying files"
  fi

  if [ -z "$(git status --porcelain)" ]; then
    pass "working tree clean"
  else
    warn "working tree has uncommitted changes"
  fi

  if git remote get-url origin >/dev/null 2>&1; then
    pass "git origin configured"
  else
    warn "git origin not configured"
  fi
else
  warn "not currently inside a git repository"
fi

if [ -f package.json ]; then
  pass "package.json present"
else
  warn "package.json not found in current directory"
fi

echo
echo "Summary: PASS=$PASS WARN=$WARN FAIL=$FAIL"
if [ "$FAIL" -gt 0 ]; then
  exit 2
fi
exit 0
