#!/usr/bin/env bash
set -euo pipefail

echo "PALTA REPOSITORY SAFETY CHECK"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "FAIL: not inside a git repository"
  exit 10
fi

branch="$(git branch --show-current)"
head="$(git rev-parse HEAD)"

echo "repo: $(git rev-parse --show-toplevel)"
echo "branch: $branch"
echo "head: $head"

if [ "$branch" = "main" ] || [ "$branch" = "master" ]; then
  echo "FAIL: refusing implementation writes on protected branch '$branch'"
  exit 11
fi

case "$branch" in
  integration/*) ;;
  *)
    echo "FAIL: expected integration/* branch, got '$branch'"
    exit 12
    ;;
esac

if [ -n "$(git status --porcelain)" ]; then
  echo "FAIL: working tree is not clean"
  git status --short
  exit 13
fi

echo "PASS: repository is safe for Palta integration work"
