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

backup="/tmp/palta-primary-surfaces-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup"

files=(
  "app/_layout.tsx"
  "app/(tabs)/_layout.tsx"
  "app/(tabs)/index.tsx"
  "app/(tabs)/home.tsx"
  "app/(tabs)/community.tsx"
  "app/search/index.tsx"
  "app/context/[contextId].tsx"
  "app/community/[communitySpaceId].tsx"
  "app/community/[communitySpaceId]/post/[postId].tsx"
  "features/home/HomeScreen.tsx"
  "features/community/CommunityScreen.tsx"
  "features/community/communityRuntime.ts"
  "components/HomeCandidateCard.tsx"
  "components/ScreenFrame.tsx"
  "components/common/FilterChip.tsx"
  "components/common/PaltaButton.tsx"
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

echo "Home and Community primary surfaces synced to apps/mobile/src."
echo "Backup of replaced files: $backup"
echo "No branch switch, merge, delete, dependency install, or unrelated file mutation was performed."
