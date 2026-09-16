#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/repo-safety-check.sh"

ROOT="$(git rev-parse --show-toplevel)"
APP_DIR="$ROOT/apps/mobile"

if [ -e "$APP_DIR" ]; then
  echo "FAIL: $APP_DIR already exists. Refusing to overwrite."
  exit 20
fi

echo "Creating Expo app shell at $APP_DIR"
mkdir -p "$ROOT/apps"

cd "$ROOT/apps"
npx create-expo-app@latest mobile --template blank-typescript

cd "$APP_DIR"
npx expo install expo-router expo-location expo-sqlite expo-secure-store expo-notifications expo-haptics expo-speech
npx expo install @maplibre/maplibre-react-native

echo
echo "Expo shell created. No Palta overlay copied automatically."
echo "Next: review and copy mobile-overlay/ intentionally."
echo "This script does not commit or push."
