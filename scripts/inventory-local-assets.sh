#!/usr/bin/env bash
set -u

ROOT="${PALTA_DATA_ROOT:-/Users/user/palta-data}"

echo "PALTA LOCAL ASSET INVENTORY"
echo "root: $ROOT"

if [ ! -d "$ROOT" ]; then
  echo "MISSING root"
  exit 2
fi

printf "%-12s %-12s %s\n" "TYPE" "SIZE" "PATH"

find "$ROOT" -type f \( \
  -name "*.pmtiles" -o \
  -name "*.mbtiles" -o \
  -name "*.json" -o \
  -name "*.geojson" -o \
  -name "*.csv" -o \
  -name "*.zip" \
\) -print0 2>/dev/null |
while IFS= read -r -d '' file; do
  size="$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo '?')"
  case "$file" in
    *.pmtiles) type="PMTILES" ;;
    *.mbtiles) type="MBTILES" ;;
    *.geojson) type="GEOJSON" ;;
    *.json) type="JSON" ;;
    *.csv) type="CSV" ;;
    *.zip) type="ZIP" ;;
    *) type="FILE" ;;
  esac
  printf "%-12s %-12s %s\n" "$type" "$size" "$file"
done

echo
echo "No files were changed."
