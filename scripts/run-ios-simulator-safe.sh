#!/usr/bin/env bash
set -euo pipefail

TARGET_BRANCH="${PALTA_SIMULATOR_BRANCH:-integration/simulator-runtime-fix-v1}"
MOCK_PORT="${PALTA_MOCK_PORT:-8787}"
fail() { echo "FAIL: $1" >&2; exit "${2:-1}"; }
info() { echo "[Palta Simulator] $1"; }
[ "$(uname -s)" = "Darwin" ] || fail "This launcher must run on macOS."
for cmd in git node npm xcrun xcodebuild open lsof rsync; do command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"; done
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"; [ -n "$ROOT" ] || fail "Run this from inside the Palta git repository."; cd "$ROOT"
APP_DIR="$ROOT/apps/mobile"
CONFIG_SOURCE="$ROOT/mobile-overlay/app.config.v2.7.template.ts"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/apps/mobile.backup-$STAMP"
BUILD_DIR="$ROOT/apps/mobile.clean-$STAMP"

[ -f "$CONFIG_SOURCE" ] || fail "Canonical Expo config missing: $CONFIG_SOURCE"
if [ -d "$APP_DIR" ]; then info "Preserving the complete existing mobile runtime at $BACKUP_DIR"; mv "$APP_DIR" "$BACKUP_DIR"; fi
restore_old_runtime() { if [ ! -d "$APP_DIR" ] && [ -d "$BACKUP_DIR" ]; then mv "$BACKUP_DIR" "$APP_DIR"; fi; }
trap 'restore_old_runtime' ERR

info "Creating a clean Expo runtime; stale node_modules and ios artifacts will not be reused..."
mkdir -p "$ROOT/apps"
(cd "$ROOT/apps" && npx create-expo-app@latest "$(basename "$BUILD_DIR")" --template blank-typescript --yes >/tmp/palta-clean-expo.log 2>&1) || { cat /tmp/palta-clean-expo.log >&2; fail "Clean Expo shell creation failed."; }
[ -f "$BUILD_DIR/package.json" ] || fail "Clean Expo shell did not produce package.json."
if [ -f "$BACKUP_DIR/.env.local" ]; then cp "$BACKUP_DIR/.env.local" "$BUILD_DIR/.env.local"; fi
cp "$CONFIG_SOURCE" "$BUILD_DIR/app.config.ts"; rm -f "$BUILD_DIR/app.json"; mkdir -p "$BUILD_DIR/src"; rsync -a --delete "$ROOT/mobile-overlay/src/" "$BUILD_DIR/src/"

cd "$BUILD_DIR"
export npm_config_legacy_peer_deps=true
info "Installing Palta native dependencies and iOS scene lifecycle support..."
npm install --save @maplibre/maplibre-react-native --legacy-peer-deps >/tmp/palta-clean-install.log 2>&1 || { cat /tmp/palta-clean-install.log >&2; fail "MapLibre install failed in clean runtime."; }
npx expo install expo-router expo-location expo-sqlite expo-secure-store expo-notifications expo-haptics expo-speech expo-build-properties >>/tmp/palta-clean-install.log 2>&1 || { cat /tmp/palta-clean-install.log >&2; fail "Expo dependency install failed in clean runtime."; }
unset npm_config_legacy_peer_deps
node -e "require.resolve('@maplibre/maplibre-react-native/package.json'); require.resolve('expo-router/package.json'); require.resolve('expo-sqlite/package.json'); require.resolve('expo-secure-store/package.json'); require.resolve('expo-build-properties/package.json'); console.log('Palta dependency resolution passed.')" || fail "Required package resolution failed."
npx expo config --type public >/tmp/palta-expo-config.log 2>&1 || { cat /tmp/palta-expo-config.log >&2; fail "Expo config/plugin resolution failed in clean runtime."; }
info "Generating a fresh iOS native project with UIScene support..."
npx expo prebuild --clean --platform ios >/tmp/palta-prebuild.log 2>&1 || { cat /tmp/palta-prebuild.log >&2; fail "Expo iOS prebuild with scene support failed."; }
PLIST="$(find "$BUILD_DIR/ios" -name Info.plist -path '*/Palta/*' -print -quit 2>/dev/null || true)"
[ -n "$PLIST" ] || PLIST="$(find "$BUILD_DIR/ios" -name Info.plist -not -path '*/Pods/*' -print -quit 2>/dev/null || true)"
[ -n "$PLIST" ] || fail "Generated Palta Info.plist not found."
/usr/libexec/PlistBuddy -c 'Print :UIApplicationSceneManifest' "$PLIST" >/tmp/palta-scene-manifest.log 2>&1 || { cat /tmp/palta-scene-manifest.log >&2; fail "UIScene manifest was not generated; refusing to launch incompatible iOS runtime."; }
info "UIScene manifest verified."
cd "$ROOT"

info "Fetching verified simulator recovery files without switching branch..."
git fetch origin "$TARGET_BRANCH:refs/remotes/origin/$TARGET_BRANCH" >/dev/null
REF="origin/$TARGET_BRANCH"; git rev-parse --verify "$REF" >/dev/null 2>&1 || fail "Cannot resolve $REF."
restore_ref_file() { SOURCE_PATH="$1"; DEST_PATH="$2"; git cat-file -e "$REF:$SOURCE_PATH" 2>/dev/null || fail "Recovery source missing: $SOURCE_PATH"; mkdir -p "$(dirname "$DEST_PATH")"; git show "$REF:$SOURCE_PATH" > "$DEST_PATH"; }
restore_ref_file "mobile-overlay/src/hooks/useAsyncResource.ts" "$BUILD_DIR/src/hooks/useAsyncResource.ts"
restore_ref_file "mobile-overlay/src/components/map/NeighborhoodMap.tsx" "$BUILD_DIR/src/components/map/NeighborhoodMap.tsx"
restore_ref_file "mobile-overlay/src/features/neighborhood/NeighborhoodScreen.tsx" "$BUILD_DIR/src/features/neighborhood/NeighborhoodScreen.tsx"

mv "$BUILD_DIR" "$APP_DIR"; trap - ERR
info "Clean scene-enabled runtime promoted to apps/mobile. Previous runtime preserved at $BACKUP_DIR"
for script in ensure-mobile-router-runtime.sh sync-mobile-home-overlay.sh; do [ -f "$ROOT/scripts/$script" ] || fail "Required runtime script missing: scripts/$script"; done
bash "$ROOT/scripts/ensure-mobile-router-runtime.sh"; bash "$ROOT/scripts/sync-mobile-home-overlay.sh"

SMOKE_PATH="dev/mock-api/smoke.mjs"; git cat-file -e "$REF:$SMOKE_PATH" 2>/dev/null || fail "Recovery smoke test missing: $SMOKE_PATH"
TMP_SMOKE_DIR="$(mktemp -d /tmp/palta-smoke.XXXXXX)"; TMP_SMOKE="$TMP_SMOKE_DIR/smoke.mjs"; git show "$REF:$SMOKE_PATH" > "$TMP_SMOKE"; trap 'rm -rf "${TMP_SMOKE_DIR:-}"' EXIT
export EXPO_PUBLIC_PALTA_API_BASE_URL="http://127.0.0.1:${MOCK_PORT}" EXPO_PUBLIC_ENV="development" PALTA_MOCK_BASE_URL="http://127.0.0.1:${MOCK_PORT}"
if lsof -nP -iTCP:"$MOCK_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then info "Reusing mock API on port $MOCK_PORT."; else PALTA_MOCK_PORT="$MOCK_PORT" nohup node "$ROOT/dev/mock-api/server.mjs" >/tmp/palta-mock-api.log 2>&1 & echo $! >/tmp/palta-mock-api.pid; sleep 1; fi
node "$TMP_SMOKE" || { tail -80 /tmp/palta-mock-api.log 2>/dev/null || true; fail "Mock API smoke test failed."; }; info "Mock API smoke test passed."

DEVELOPER_DIR="$(xcode-select -p 2>/dev/null || true)"; SIMULATOR_APP="${DEVELOPER_DIR}/Applications/Simulator.app"; [ ! -d "$SIMULATOR_APP" ] || open "$SIMULATOR_APP" >/dev/null 2>&1 || true
BOOTED_UDID="$(xcrun simctl list devices booted | awk -F '[()]' '/iPhone/ && /Booted/ {print $2; exit}')"
if [ -n "$BOOTED_UDID" ]; then UDID="$BOOTED_UDID"; else DEVICE_LINE="$(xcrun simctl list devices available | awk '/iPhone 18 Pro/ {print; exit}')"; [ -n "$DEVICE_LINE" ] || DEVICE_LINE="$(xcrun simctl list devices available | awk '/iPhone/ {print; exit}')"; [ -n "$DEVICE_LINE" ] || fail "No available iPhone Simulator device found."; UDID="$(printf '%s\n' "$DEVICE_LINE" | sed -E 's/.*\(([0-9A-Fa-f-]{36})\).*/\1/')"; xcrun simctl boot "$UDID" 2>/dev/null || true; fi
xcrun simctl bootstatus "$UDID" -b
cd "$APP_DIR"; info "Building, installing, and launching scene-enabled Palta runtime..."; npx expo run:ios --device "$UDID"
