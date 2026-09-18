#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT/apps/mobile"
PACKAGE="$APP_DIR/package.json"
CONFIG_SOURCE="$ROOT/mobile-overlay/app.config.v2.7.template.ts"
CONFIG_DEST="$APP_DIR/app.config.ts"

[ -f "$PACKAGE" ] || { echo "ERROR: $PACKAGE not found" >&2; exit 1; }
[ -f "$CONFIG_SOURCE" ] || { echo "ERROR: $CONFIG_SOURCE not found" >&2; exit 1; }

backup="/tmp/palta-router-runtime-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup"
cp "$PACKAGE" "$backup/package.json"
[ ! -f "$CONFIG_DEST" ] || cp "$CONFIG_DEST" "$backup/app.config.ts"

node - "$PACKAGE" <<'NODE'
const fs = require('fs');
const path = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.main = 'expo-router/entry';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
NODE

cp "$CONFIG_SOURCE" "$CONFIG_DEST"

echo "Palta runtime entry normalized: expo-router/entry -> src/app routes."
echo "Runtime config synced: apps/mobile/app.config.ts"
echo "Backup: $backup"
