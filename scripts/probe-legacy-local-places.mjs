#!/usr/bin/env node

const endpoint =
  process.env.PALTA_LEGACY_LOCAL_PLACES_URL ??
  'https://narevu-api.kimeuisin.workers.dev/v1/cl/local-places';

function objectKeys(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).sort();
}

function summarizePayload(value) {
  if (Array.isArray(value)) {
    const keys = new Set();
    for (const item of value.slice(0, 50)) {
      for (const key of objectKeys(item)) keys.add(key);
    }
    return {
      shape: 'array',
      item_count: value.length,
      item_keys: [...keys].sort(),
    };
  }

  if (value?.type === 'FeatureCollection' && Array.isArray(value.features)) {
    const propertyKeys = new Set();
    const geometryTypes = new Set();
    for (const feature of value.features.slice(0, 50)) {
      for (const key of objectKeys(feature?.properties)) propertyKeys.add(key);
      if (typeof feature?.geometry?.type === 'string') {
        geometryTypes.add(feature.geometry.type);
      }
    }
    return {
      shape: 'geojson-feature-collection',
      feature_count: value.features.length,
      property_keys: [...propertyKeys].sort(),
      geometry_types: [...geometryTypes].sort(),
    };
  }

  const keys = objectKeys(value);
  const collectionCandidates = [];
  for (const key of keys) {
    if (!Array.isArray(value[key])) continue;
    const itemKeys = new Set();
    for (const item of value[key].slice(0, 50)) {
      for (const itemKey of objectKeys(item)) itemKeys.add(itemKey);
    }
    collectionCandidates.push({
      key,
      item_count: value[key].length,
      item_keys: [...itemKeys].sort(),
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
