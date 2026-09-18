#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT" ]; then
  echo "FAIL: run this inside the Palta git repository." >&2
  exit 1
fi

APP="$ROOT/apps/mobile"
FAILS=0
WARNINGS=0

pass() { printf 'PASS: %s\n' "$1"; }
warn() { printf 'WARN: %s\n' "$1"; WARNINGS=$((WARNINGS + 1)); }
fail() { printf 'FAIL: %s\n' "$1"; FAILS=$((FAILS + 1)); }

printf 'Palta mobile runtime promotion preflight\n'
printf 'Repository: %s\n' "$ROOT"
printf 'Candidate app: %s\n\n' "$APP"

if [ ! -d "$APP" ]; then
  fail "apps/mobile does not exist on this machine. Do not create a second app automatically; recover/locate the existing runtime first."
  printf '\nRESULT: FAIL (%s failures, %s warnings)\n' "$FAILS" "$WARNINGS"
  exit 1
fi
pass "apps/mobile directory exists."

if [ -f "$APP/package.json" ]; then
  pass "apps/mobile/package.json exists."
else
  fail "apps/mobile/package.json is missing."
fi

LOCK_COUNT=0
for lock in package-lock.json yarn.lock pnpm-lock.yaml bun.lock bun.lockb; do
  if [ -f "$APP/$lock" ]; then
    printf 'INFO: mobile lockfile: %s\n' "$lock"
    LOCK_COUNT=$((LOCK_COUNT + 1))
  fi
done
if [ "$LOCK_COUNT" -eq 1 ]; then
  pass "Exactly one mobile lockfile detected."
elif [ "$LOCK_COUNT" -eq 0 ]; then
  warn "No lockfile found inside apps/mobile. Confirm whether the repository intentionally uses a root workspace lockfile before promotion."
else
  fail "Multiple lockfiles detected inside apps/mobile; choose one package-manager source of truth before commit."
fi

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
  if [ "$NODE_MAJOR" -ge 22 ]; then
    pass "Node $(node -v) satisfies Palta Node 22+ baseline."
  else
    fail "Node 22+ required by current Palta repository baseline; found $(node -v)."
  fi
else
  fail "node command not found."
fi

if [ -f "$APP/package.json" ] && command -v node >/dev/null 2>&1; then
  node - "$APP/package.json" <<'NODE' || true
const fs = require('fs');
const path = process.argv[2];
try {
  const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
  const all = {...(pkg.dependencies || {}), ...(pkg.devDependencies || {})};
  console.log(`INFO: package name: ${pkg.name || '(none)'}`);
  console.log(`INFO: expo dependency: ${all.expo || '(not declared)'}`);
  console.log(`INFO: expo-router dependency: ${all['expo-router'] || '(not declared)'}`);
  console.log(`INFO: react-native dependency: ${all['react-native'] || '(not declared)'}`);
  console.log(`INFO: MapLibre dependency: ${all['@maplibre/maplibre-react-native'] || '(not declared)'}`);
} catch (err) {
  console.log(`WARN: could not parse package.json: ${err.message}`);
}
NODE
fi

CONFIG_FOUND=0
for f in app.config.ts app.config.js app.json; do
  if [ -f "$APP/$f" ]; then
    printf 'INFO: Expo config candidate: %s\n' "$f"
    CONFIG_FOUND=$((CONFIG_FOUND + 1))
  fi
done
if [ "$CONFIG_FOUND" -eq 0 ]; then
  warn "No app.config.ts/app.config.js/app.json found in apps/mobile."
elif [ "$CONFIG_FOUND" -gt 1 ]; then
  warn "Multiple Expo config candidates found; confirm which one is authoritative."
else
  pass "Expo app configuration file detected."
fi

if grep -RIl --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=build --exclude-dir=.expo \
  -E 'cl\.somospalta\.app|scheme:[[:space:]]*["'"']palta["'"']|"scheme"[[:space:]]*:[[:space:]]*"palta"' "$APP" >/dev/null 2>&1; then
  pass "Palta app identifier/scheme evidence found."
else
  warn "Could not confirm cl.somospalta.app or palta scheme from text scan. Review Expo config manually."
fi

printf '\n-- Local/private file candidates --\n'
PRIVATE_FOUND=0
while IFS= read -r file; do
  [ -n "$file" ] || continue
  printf 'REVIEW: %s\n' "${file#$ROOT/}"
  PRIVATE_FOUND=1
done < <(find "$APP" -type f \( \
  -name '.env' -o -name '.env.local' -o -name '.env.development' -o -name '.env.production' -o \
  -name '*.p12' -o -name '*.pfx' -o -name '*.pem' -o -name '*.key' -o \
  -name '*.mobileprovision' -o -name '*.jks' -o -name '*.keystore' -o \
  -name 'GoogleService-Info.plist' -o -name 'google-services.json' \
\) -print 2>/dev/null)
if [ "$PRIVATE_FOUND" -eq 0 ]; then
  pass "No common private/signing file candidates found by filename scan."
else
  warn "Private/signing/config candidates exist. Review each before any git add; presence does not prove it is secret."
fi

printf '\n-- Generated/local directory candidates --\n'
for d in node_modules .expo dist build ios/build android/.gradle android/app/build; do
  if [ -e "$APP/$d" ]; then
    printf 'INFO: local/generated path exists: apps/mobile/%s\n' "$d"
  fi
done

printf '\n-- Git tracking status --\n'
TRACKED_COUNT="$(git -C "$ROOT" ls-files 'apps/mobile/**' | wc -l | tr -d ' ')"
printf 'INFO: currently tracked files under apps/mobile: %s\n' "$TRACKED_COUNT"
if [ "$TRACKED_COUNT" -eq 0 ]; then
  warn "apps/mobile is not yet source-controlled. This matches the current platform-foundation status."
else
  pass "apps/mobile already has tracked files; review current branch/history before promotion."
fi

if git -C "$ROOT" status --porcelain -- apps/mobile | grep -q .; then
  printf 'INFO: apps/mobile working-tree changes exist:\n'
  git -C "$ROOT" status --short -- apps/mobile
else
  printf 'INFO: no Git-visible apps/mobile working-tree changes.\n'
fi

printf '\n-- Conservative credential-pattern scan --\n'
# This is only a warning scan. It intentionally does not print matching values.
PATTERN='(service_role|SUPABASE_SERVICE_ROLE|PAYMENT_PROVIDER_ACCESS_TOKEN|PAYMENT_WEBHOOK_SECRET|PRIVATE_KEY|BEGIN[[:space:]]+PRIVATE[[:space:]]+KEY|DATABASE_URL=.*://[^[:space:]]+:[^[:space:]@]+@)'
MATCH_FILES="$(grep -RIlE --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.expo --exclude='*.lock' "$PATTERN" "$APP" 2>/dev/null || true)"
if [ -z "$MATCH_FILES" ]; then
  pass "No high-risk credential pattern found by conservative text scan."
else
  warn "Potential credential-bearing files detected. Values are intentionally not printed:"
  while IFS= read -r file; do
    [ -n "$file" ] && printf 'REVIEW: %s\n' "${file#$ROOT/}"
  done <<< "$MATCH_FILES"
fi

printf '\n-- Promotion rule --\n'
printf 'Do NOT run git add -A from repository root until REVIEW/WARN items are resolved.\n'
printf 'Do NOT create another Expo application while this apps/mobile exists.\n'

if [ "$FAILS" -gt 0 ]; then
  printf '\nRESULT: FAIL (%s failures, %s warnings)\n' "$FAILS" "$WARNINGS"
  exit 1
fi

printf '\nRESULT: READY FOR MANUAL REVIEW (%s warnings)\n' "$WARNINGS"
printf 'No files were modified by this script.\n'
