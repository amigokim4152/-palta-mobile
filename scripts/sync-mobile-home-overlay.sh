#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f apps/mobile/package.json ]]; then
  echo "ERROR: apps/mobile/package.json not found. Run scripts/bootstrap-mobile.sh first." >&2
  exit 1
fi

if [[ ! -d mobile-overlay/src ]]; then
  echo "ERROR: mobile-overlay/src not found." >&2
  exit 1
fi

backup="/tmp/palta-home-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup"

files=(
  "app/(tabs)/index.tsx"
  "app/(tabs)/home.tsx"
  "features/home/HomeScreen.tsx"
  "components/HomeCandidateCard.tsx"
  "components/ScreenFrame.tsx"
  "theme/paltaTheme.ts"
)

for rel in "${files[@]}"; do
  src="mobile-overlay/src/$rel"
  dst="apps/mobile/src/$rel"
  if [[ ! -f "$src" ]]; then
    echo "ERROR: overlay source missing: $src" >&2
    exit 1
  fi
  if [[ -f "$dst" ]]; then
    mkdir -p "$backup/$(dirname "$rel")"
    cp "$dst" "$backup/$rel"
  fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
done

echo "Home overlay synced to apps/mobile/src."
echo "Backup of replaced files: $backup"
echo "No branch switch, merge, delete, dependency install, or unrelated file mutation was performed."
