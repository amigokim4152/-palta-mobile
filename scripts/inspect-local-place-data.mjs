#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const DEFAULT_ROOTS = [
  '/Users/user/palta-data/work/cl/local-place',
  '/Users/user/palta-data/work/cl',
  '/Users/user/palta-data/work',
  '/Users/user/palta-data/r2-backup/narevu',
];

const SUPPORTED = new Set([
  '.json',
  '.geojson',
  '.jsonl',
  '.ndjson',
  '.csv',
  '.pmtiles',
]);
const MAX_FILES = Number(process.env.PALTA_LOCAL_INSPECT_MAX_FILES ?? 600);
const MAX_JSON_PARSE_BYTES = 16 * 1024 * 1024;
const MAX_DEPTH = Number(process.env.PALTA_LOCAL_INSPECT_MAX_DEPTH ?? 7);

function existingRoots() {
  const supplied = process.argv.slice(2).filter(Boolean);
  const envRoots = (process.env.PALTA_LOCAL_DATA_ROOTS ?? '')
    .split(path.delimiter)
    .filter(Boolean);
  const roots = supplied.length ? supplied : envRoots.length ? envRoots : DEFAULT_ROOTS;
  return [...new Set(roots.map((value) => path.resolve(value)))].filter((value) => {
    try {
      return fs.statSync(value).isDirectory();
    } catch {
      return false;
    }
  });
}

function walk(root, depth = 0, out = []) {
  if (out.length >= MAX_FILES || depth > MAX_DEPTH) return out;
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (out.length >= MAX_FILES) break;
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walk(full, depth + 1, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED.has(ext)) continue;
    out.push(full);
  }
  return out;
}

function safeStat(file) {
  const stat = fs.statSync(file);
  return { size_bytes: stat.size, modified_at: stat.mtime.toISOString() };
}

function keyList(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).sort();
}

function inspectJson(file, size) {
  if (size > MAX_JSON_PARSE_BYTES) {
    const fd = fs.openSync(file, 'r');
    try {
      const length = Math.min(size, 128 * 1024);
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, 0);
      const head = buffer.toString('utf8');
      const candidateKeys = [...head.matchAll(/"([A-Za-z0-9_:-]{2,80})"\s*:/g)]
        .map((match) => match[1]);
      return {
        format: 'json-large',
        parsed: false,
        head_keys: [...new Set(candidateKeys)].slice(0, 80).sort(),
      };
    } finally {
      fs.closeSync(fd);
    }
  }

  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (value?.type === 'FeatureCollection' && Array.isArray(value.features)) {
    const propertyKeys = new Set();
    const geometryTypes = new Set();
    for (const feature of value.features.slice(0, 250)) {
      for (const key of keyList(feature?.properties)) propertyKeys.add(key);
      if (typeof feature?.geometry?.type === 'string') geometryTypes.add(feature.geometry.type);
    }
    return {
      format: 'geojson-feature-collection',
      feature_count: value.features.length,
      property_keys: [...propertyKeys].sort(),
      geometry_types: [...geometryTypes].sort(),
    };
  }

  if (Array.isArray(value)) {
    const itemKeys = new Set();
    for (const item of value.slice(0, 250)) {
      for (const key of keyList(item)) itemKeys.add(key);
    }
    return {
      format: 'json-array',
      item_count: value.length,
      item_keys: [...itemKeys].sort(),
    };
  }

  const topKeys = keyList(value);
  const likelyArrays = {};
  for (const key of topKeys) {
    if (Array.isArray(value[key])) likelyArrays[key] = value[key].length;
  }
  return {
    format: 'json-object',
    top_keys: topKeys,
    array_lengths: likelyArrays,
  };
}

function inspectLineJson(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const stat = fs.fstatSync(fd);
    const length = Math.min(stat.size, 128 * 1024);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, 0);
    const line = buffer.toString('utf8').split(/\r?\n/).find((item) => item.trim());
    if (!line) return { format: 'line-json', item_keys: [] };
    const value = JSON.parse(line);
    return { format: 'line-json', item_keys: keyList(value) };
  } finally {
    fs.closeSync(fd);
  }
}

function inspectCsv(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const stat = fs.fstatSync(fd);
    const length = Math.min(stat.size, 64 * 1024);
    const buffer = Buffer.alloc(length);
    fs.readSync(fd, buffer, 0, length, 0);
    const firstLine = buffer.toString('utf8').split(/\r?\n/)[0] ?? '';
    return {
      format: 'csv',
      columns: firstLine
        .split(',')
        .map((value) => value.trim().replace(/^"|"$/g, ''))
        .filter(Boolean)
        .slice(0, 120),
    };
  } finally {
    fs.closeSync(fd);
  }
}

function uint64(view, offset) {
  const value = Number(view.getBigUint64(offset, true));
  if (!Number.isSafeInteger(value)) throw new Error('unsafe PMTiles offset');
  return value;
}

function inspectPmtiles(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const header = Buffer.alloc(127);
    fs.readSync(fd, header, 0, header.length, 0);
    if (header.subarray(0, 7).toString('utf8') !== 'PMTiles') {
      throw new Error('invalid PMTiles magic');
    }
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    const metadataOffset = uint64(view, 24);
    const metadataLength = uint64(view, 32);
    const internalCompression = header[97];
    const metadataBuffer = Buffer.alloc(metadataLength);
    fs.readSync(fd, metadataBuffer, 0, metadataLength, metadataOffset);
    const decoded = internalCompression === 2
      ? zlib.gunzipSync(metadataBuffer)
      : metadataBuffer;
    const metadata = JSON.parse(decoded.toString('utf8'));
    const vectorLayers = Array.isArray(metadata?.vector_layers)
      ? metadata.vector_layers.map((layer) => ({
          id: layer?.id,
          fields: Object.keys(layer?.fields ?? {}).sort(),
          minzoom: layer?.minzoom,
          maxzoom: layer?.maxzoom,
        }))
      : [];
    return {
      format: 'pmtiles',
      pmtiles_version: header[7],
      min_zoom: header[100],
      max_zoom: header[101],
      vector_layers: vectorLayers,
    };
  } finally {
    fs.closeSync(fd);
  }
}

function inspectFile(file) {
  const stat = safeStat(file);
  const ext = path.extname(file).toLowerCase();
  let schema;
  try {
    if (ext === '.json' || ext === '.geojson') schema = inspectJson(file, stat.size_bytes);
    else if (ext === '.jsonl' || ext === '.ndjson') schema = inspectLineJson(file);
    else if (ext === '.csv') schema = inspectCsv(file);
    else if (ext === '.pmtiles') schema = inspectPmtiles(file);
    else schema = { format: ext.slice(1) };
  } catch (error) {
    schema = {
      format: ext.slice(1),
      inspect_error: error instanceof Error ? error.message : String(error),
    };
  }

  const searchable = JSON.stringify(schema).toLowerCase();
  const fileHint = file.toLowerCase();
  let score = 0;
  if (/local[-_ ]?place|business|negocio|place/.test(fileHint)) score += 3;
  if (/name|nombre/.test(searchable)) score += 1;
  if (/lat|lng|lon|longitude|latitude|geometry|location/.test(searchable)) score += 2;
  if (/category|categoria|kind|type/.test(searchable)) score += 1;
  if (/address|direccion|phone|whatsapp|website|opening|hours/.test(searchable)) score += 1;

  return {
    path: file,
    ...stat,
    candidate_score: score,
    schema,
  };
}

const roots = existingRoots();
if (!roots.length) {
  console.error('No Palta local-data directories were found.');
  console.error('Checked:', DEFAULT_ROOTS.join(', '));
  process.exit(2);
}

const seen = new Set();
const files = [];
for (const root of roots) {
  for (const file of walk(root)) {
    let canonical = file;
    try { canonical = fs.realpathSync(file); } catch {}
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    files.push(file);
    if (files.length >= MAX_FILES) break;
  }
  if (files.length >= MAX_FILES) break;
}

const inspected = files
  .map(inspectFile)
  .sort((a, b) => b.candidate_score - a.candidate_score || b.size_bytes - a.size_bytes);

const likely = inspected.filter((item) => item.candidate_score >= 4).slice(0, 30);
const result = {
  schema_version: 1,
  mode: 'read_only_inventory',
  roots,
  files_scanned: inspected.length,
  truncated: inspected.length >= MAX_FILES,
  likely_local_place_sources: likely,
  all_supported_files: inspected,
};

console.log(JSON.stringify(result, null, 2));
