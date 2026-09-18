#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="${PALTA_SIMULATOR_BRANCH:-integration/simulator-runtime-fix-v1}"
MOCK_PORT="${PALTA_MOCK_PORT:-8787}"
BACKUP_DIR=""
fail() { echo "FAIL: $1" >&2; exit "${2:-1}"; }
info() { echo "[Palta Simulator] $1"; }
[ "$(uname -s)" = "Darwin" ] || fail "This launcher must run on macOS."
for cmd in git node npm xcrun xcodebuild open lsof; do command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"; done
NODE_MAJOR="$(node -e "process.stdout.write(process.versions.node.split('.')[0])")"; [ "$NODE_MAJOR" -ge 22 ] || fail "Node 22+ required; found $(node -v)."
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"; [ -n "$ROOT" ] || fail "Run this from inside the Palta git repository."; cd "$ROOT"
APP_DIR="$ROOT/apps/mobile"

# apps/mobile is a local Expo runtime and may be partially preserved across branch
# switches. Never delete it: recover missing root metadata in a temporary shell,
# then copy metadata only, preserving src, ios, .env.local, .expo and node_modules.
if [ ! -f "$APP_DIR/package.json" ]; then
  if [ -d "$APP_DIR" ]; then
    info "Partial local Expo runtime detected; preserving existing Palta runtime and restoring missing metadata..."
    RUNTIME_BACKUP="/tmp/palta-partial-runtime-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$RUNTIME_BACKUP"
    for item in .env.local expo-env.d.ts; do [ ! -f "$APP_DIR/$item" ] || cp "$APP_DIR/$item" "$RUNTIME_BACKUP/$item"; done
    TMP_ROOT="$(mktemp -d /tmp/palta-expo-shell.XXXXXX)"
    trap 'rm -rf "${TMP_ROOT:-}" "${TMP_SMOKE:-}"' EXIT
    info "Creating a clean Expo metadata donor without touching the existing runtime..."
    (cd "$TMP_ROOT" && npx create-expo-app@latest mobile --template blank-typescript --yes >/tmp/palta-expo-bootstrap.log 2>&1)
    DONOR="$TMP_ROOT/mobile"
    [ -f "$DONOR/package.json" ] || { cat /tmp/palta-expo-bootstrap.log >&2 2>/dev/null || true; fail "Temporary Expo metadata bootstrap failed."; }
    for item in package.json package-lock.json tsconfig.json app.json; do [ ! -f "$DONOR/$item" ] || cp "$DONOR/$item" "$APP_DIR/$item"; done
    info "Missing Expo root metadata restored. Existing src/ios/env/dependencies were preserved. Backup: $RUNTIME_BACKUP"
  else
    info "Local Expo runtime is absent; creating it from the canonical Palta overlay..."
    chmod +x "$ROOT/scripts/bootstrap-mobile.sh"
    "$ROOT/scripts/bootstrap-mobile.sh"
    [ -f "$APP_DIR/package.json" ] || fail "Expo bootstrap did not create $APP_DIR/package.json."
    mkdir -p "$APP_DIR/src"
    cp -R "$ROOT/mobile-overlay/src/." "$APP_DIR/src/"
    info "Canonical mobile overlay seeded into the new Expo runtime."
  fi
fi
info "Using mobile runtime: $APP_DIR"

# Ensure the recovered/new shell has the native dependencies required by the Palta overlay.
cd "$APP_DIR"
npx expo install expo-router expo-location expo-sqlite expo-secure-store expo-notifications expo-haptics expo-speech >/tmp/palta-expo-install.log 2>&1 || { cat /tmp/palta-expo-install.log >&2; fail "Expo dependency reconciliation failed."; }
npx expo install @maplibre/maplibre-react-native >>/tmp/palta-expo-install.log 2>&1 || { cat /tmp/palta-expo-install.log >&2; fail "MapLibre dependency reconciliation failed."; }
cd "$ROOT"

info "Fetching simulator recovery branch without switching your current branch..."
git fetch origin "$TARGET_BRANCH:refs/remotes/origin/$TARGET_BRANCH" >/dev/null
REF="origin/$TARGET_BRANCH"; git rev-parse --verify "$REF" >/dev/null 2>&1 || fail "Cannot resolve $REF after fetch."
ensure_backup_dir() { if [ -z "$BACKUP_DIR" ]; then BACKUP_DIR="/tmp/palta-simulator-backup-$(date +%Y%m%d-%H%M%S)"; mkdir -p "$BACKUP_DIR"; fi; }
restore_ref_file() { SOURCE_PATH="$1"; DEST_PATH="$2"; LABEL="$3"; git cat-file -e "$REF:$SOURCE_PATH" 2>/dev/null || fail "Recovery source missing: $SOURCE_PATH"; TMP_SOURCE="$(mktemp /tmp/palta-restore.XXXXXX)"; git show "$REF:$SOURCE_PATH" > "$TMP_SOURCE"; mkdir -p "$(dirname "$DEST_PATH")"; if [ -f "$DEST_PATH" ] && ! cmp -s "$TMP_SOURCE" "$DEST_PATH"; then ensure_backup_dir; SAFE_NAME="$(printf '%s' "$SOURCE_PATH" | tr '/' '_')"; cp "$DEST_PATH" "$BACKUP_DIR/$SAFE_NAME"; info "Backed up previous $LABEL to $BACKUP_DIR/$SAFE_NAME"; fi; if [ ! -f "$DEST_PATH" ] || ! cmp -s "$TMP_SOURCE" "$DEST_PATH"; then cp "$TMP_SOURCE" "$DEST_PATH"; info "Restored verified $LABEL."; else info "$LABEL is already on the verified version."; fi; rm -f "$TMP_SOURCE"; }
restore_ref_file "mobile-overlay/src/hooks/useAsyncResource.ts" "$APP_DIR/src/hooks/useAsyncResource.ts" "async-resource loop fix"
restore_ref_file "mobile-overlay/src/components/map/NeighborhoodMap.tsx" "$APP_DIR/src/components/map/NeighborhoodMap.tsx" "last working MapLibre component"
restore_ref_file "mobile-overlay/src/features/neighborhood/NeighborhoodScreen.tsx" "$APP_DIR/src/features/neighborhood/NeighborhoodScreen.tsx" "last working Barrio screen"

for script in ensure-mobile-router-runtime.sh sync-mobile-home-overlay.sh; do [ -f "$ROOT/scripts/$script" ] || fail "Required runtime script missing: scripts/$script"; chmod +x "$ROOT/scripts/$script"; done
info "Normalizing Palta to a single Expo Router runtime entry..."
"$ROOT/scripts/ensure-mobile-router-runtime.sh"
info "Syncing current Home and Community product surfaces into the Expo runtime..."
"$ROOT/scripts/sync-mobile-home-overlay.sh"

EXPERIMENTAL_STYLE="$APP_DIR/src/components/map/paltaDevelopmentMapStyle.ts"; if [ -f "$EXPERIMENTAL_STYLE" ]; then ensure_backup_dir; cp "$EXPERIMENTAL_STYLE" "$BACKUP_DIR/paltaDevelopmentMapStyle.ts"; rm -f "$EXPERIMENTAL_STYLE"; info "Removed failed experimental PMTiles style from local app."; fi
SMOKE_PATH="dev/mock-api/smoke.mjs"; git cat-file -e "$REF:$SMOKE_PATH" 2>/dev/null || fail "Recovery smoke test missing: $SMOKE_PATH"; TMP_SMOKE="$(mktemp /tmp/palta-smoke.XXXXXX.mjs)"; git show "$REF:$SMOKE_PATH" > "$TMP_SMOKE"
export EXPO_PUBLIC_PALTA_API_BASE_URL="http://127.0.0.1:${MOCK_PORT}" EXPO_PUBLIC_ENV="development" PALTA_MOCK_BASE_URL="http://127.0.0.1:${MOCK_PORT}"
if lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then info "Port $MOCK_PORT already has a listener; reusing it for smoke verification."; else info "Starting Palta development mock API on port $MOCK_PORT..."; PALTA_MOCK_PORT="$MOCK_PORT" nohup node "$ROOT/dev/mock-api/server.mjs" >/tmp/palta-mock-api.log 2>&1 & echo $! >/tmp/palta-mock-api.pid; sleep 1; fi
if ! node "$TMP_SMOKE"; then echo "--- mock API log ---" >&2; tail -80 /tmp/palta-mock-api.log 2>/dev/null || true; fail "Mock API smoke test failed."; fi; info "Mock API smoke test passed."
DEVELOPER_DIR="$(xcode-select -p 2>/dev/null || true)"; SIMULATOR_APP="${DEVELOPER_DIR}/Applications/Simulator.app"; if [ -d "$SIMULATOR_APP" ]; then open "$SIMULATOR_APP" >/dev/null 2>&1 || true; fi
BOOTED_UDID="$(xcrun simctl list devices booted | awk -F '[()]' '/iPhone/ && /Booted/ {print $2; exit}')"; if [ -n "$BOOTED_UDID" ]; then UDID="$BOOTED_UDID"; else DEVICE_LINE="$(xcrun simctl list devices available | awk '/iPhone 18 Pro/ {print; exit}')"; [ -n "$DEVICE_LINE" ] || DEVICE_LINE="$(xcrun simctl list devices available | awk '/iPhone/ {print; exit}')"; [ -n "$DEVICE_LINE" ] || fail "No available iPhone Simulator device found in Xcode."; UDID="$(printf '%s\n' "$DEVICE_LINE" | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/')"; xcrun simctl boot "$UDID" 2>/dev/null || true; fi
xcrun simctl bootstatus "$UDID" -b
cd "$APP_DIR"
info "Building, installing, and launching the canonical Palta runtime..."
npx expo run:ios --device "$UDID"
