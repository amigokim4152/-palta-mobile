#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$ROOT" ] || { echo "FAIL: run inside the Palta repository" >&2; exit 1; }

REPORT="${PALTA_LOCAL_INSPECT_REPORT:-/tmp/palta-local-place-inventory.json}"

node "$ROOT/scripts/inspect-local-place-data.mjs" "$@" > "$REPORT"

node - "$REPORT" <<'NODE'
import fs from 'node:fs';
const path = process.argv[2];
const report = JSON.parse(fs.readFileSync(path, 'utf8'));
const likely = (report.likely_local_place_sources ?? []).slice(0, 12).map((item) => ({
  path: item.path,
  size_bytes: item.size_bytes,
  candidate_score: item.candidate_score,
  format: item.schema?.format,
  feature_count: item.schema?.feature_count,
  item_count: item.schema?.item_count,
  property_keys: item.schema?.property_keys,
  item_keys: item.schema?.item_keys,
  top_keys: item.schema?.top_keys,
  columns: item.schema?.columns,
  vector_layers: item.schema?.vector_layers?.map((layer) => layer.id),
}));
console.log(JSON.stringify({
  mode: report.mode,
  roots: report.roots,
  files_scanned: report.files_scanned,
  truncated: report.truncated,
  report_path: path,
  likely_local_place_sources: likely,
}, null, 2));
NODE

echo "[Palta Local Data] Full read-only inventory saved to $REPORT" >&2
