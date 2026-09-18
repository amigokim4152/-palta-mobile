#!/usr/bin/env node

const endpoint =
  process.env.PALTA_LEGACY_LOCAL_PLACES_URL ??
  'https://narevu-api.kimeuisin.workers.dev/v1/cl/local-places';

function objectKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).sort();
}

function asCollection(value) {
  if (Array.isArray(value)) return value;
  if (value?.type === 'FeatureCollection' && Array.isArray(value.features)) {
    return value.features.map((feature) => feature?.properties ?? {});
  }
  if (value && typeof value === 'object') {
    for (const key of ['items', 'results', 'data', 'places']) {
      if (Array.isArray(value[key])) return value[key];
    }
  }
  return [];
}

function valueCounts(items, key, limit = 30) {
  const counts = new Map();
  for (const item of items) {
    const raw = item?.[key];
    const value =
      raw === null || raw === undefined || raw === '' ? '(missing)' : String(raw);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function booleanSummary(items, key) {
  let trueCount = 0;
  let falseCount = 0;
  let missingCount = 0;
  for (const item of items) {
    const value = item?.[key];
    if (value === true) trueCount += 1;
    else if (value === false) falseCount += 1;
    else missingCount += 1;
  }
  return { true: trueCount, false: falseCount, missing: missingCount };
}

function fieldPresence(items, key) {
  let present = 0;
  for (const item of items) {
    const value = item?.[key];
    if (value !== null && value !== undefined && value !== '') present += 1;
  }
  return { present, missing: Math.max(items.length - present, 0) };
}

function coordinateSummary(items) {
  let valid = 0;
  let missing = 0;
  let invalid = 0;
  for (const item of items) {
    const latRaw = item?.latitude;
    const lngRaw = item?.longitude;
    if (
      latRaw === null ||
      latRaw === undefined ||
      latRaw === '' ||
      lngRaw === null ||
      lngRaw === undefined ||
      lngRaw === ''
    ) {
      missing += 1;
      continue;
    }
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      valid += 1;
    } else {
      invalid += 1;
    }
  }
  return { valid, missing, invalid };
}

function summarizeCollection(items) {
  const itemKeys = new Set();
  for (const item of items.slice(0, 100)) {
    for (const key of objectKeys(item)) itemKeys.add(key);
  }

  return {
    item_count: items.length,
    item_keys: [...itemKeys].sort(),
    distributions: {
      place_type: valueCounts(items, 'place_type'),
      status: valueCounts(items, 'status'),
      connection_status: valueCounts(items, 'connection_status'),
      map_precision: valueCounts(items, 'map_precision'),
      commune: valueCounts(items, 'commune'),
      region: valueCounts(items, 'region'),
      source_type: valueCounts(items, 'source_type'),
    },
    quality: {
      coordinates: coordinateSummary(items),
      is_essential: booleanSummary(items, 'is_essential'),
      name_es: fieldPresence(items, 'name_es'),
      linked_business_id: fieldPresence(items, 'linked_business_id'),
      phone: fieldPresence(items, 'phone'),
      whatsapp: fieldPresence(items, 'whatsapp'),
      website_url: fieldPresence(items, 'website_url'),
      source_url: fieldPresence(items, 'source_url'),
    },
  };
}

function summarizePayload(value) {
  if (Array.isArray(value)) {
    return {
      shape: 'array',
      ...summarizeCollection(value),
    };
  }

  if (value?.type === 'FeatureCollection' && Array.isArray(value.features)) {
    const geometryTypes = new Set();
    for (const feature of value.features.slice(0, 100)) {
      if (typeof feature?.geometry?.type === 'string') {
        geometryTypes.add(feature.geometry.type);
      }
    }
    const items = value.features.map((feature) => feature?.properties ?? {});
    return {
      shape: 'geojson-feature-collection',
      geometry_types: [...geometryTypes].sort(),
      ...summarizeCollection(items),
    };
  }

  const keys = objectKeys(value);
  const collectionCandidates = [];
  for (const key of keys) {
    if (!Array.isArray(value[key])) continue;
    collectionCandidates.push({
      key,
      ...summarizeCollection(value[key]),
    });
  }
  return {
    shape: 'object',
    top_keys: keys,
    collections: collectionCandidates,
  };
}

let response;
try {
  response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
} catch (error) {
  console.log(
    JSON.stringify(
      {
        endpoint,
        reachable: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const contentType = response.headers.get('content-type') ?? '';
const result = {
  endpoint,
  reachable: true,
  status: response.status,
  ok: response.ok,
  content_type: contentType,
};

if (/application\/json/i.test(contentType)) {
  try {
    const value = await response.json();
    Object.assign(result, summarizePayload(value));
  } catch (error) {
    result.parse_error = error instanceof Error ? error.message : String(error);
  }
}

console.log(JSON.stringify(result, null, 2));
