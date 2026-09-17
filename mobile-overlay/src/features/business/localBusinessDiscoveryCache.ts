import type { LocalSearchItem } from '../../../../src/api/paltaApiClient';

const MAX_ENTRIES = 12;
const MAX_AGE_MS = 2 * 60 * 1000;

type CacheEntry = {
  key: string;
  items: LocalSearchItem[];
  storedAt: number;
};

const entries = new Map<string, CacheEntry>();

function normalizeCoordinate(value: number): string {
  // Prevent tiny map floating-point differences from creating unbounded cache keys.
  // This is only an in-memory UX cache; no precise location is persisted to disk.
  return value.toFixed(4);
}

export function localBusinessDiscoveryCacheKey(input: {
  latitude: number;
  longitude: number;
  query?: string;
}): string {
  return [
    normalizeCoordinate(input.latitude),
    normalizeCoordinate(input.longitude),
    (input.query ?? '').trim().toLocaleLowerCase('es-CL'),
  ].join('|');
}

export function readLocalBusinessDiscoveryCache(
  key: string,
  now = Date.now(),
): LocalSearchItem[] | undefined {
  const entry = entries.get(key);
  if (!entry) return undefined;
  if (now - entry.storedAt > MAX_AGE_MS) {
    entries.delete(key);
    return undefined;
  }
  return entry.items;
}

export function writeLocalBusinessDiscoveryCache(
  key: string,
  items: readonly LocalSearchItem[],
  now = Date.now(),
) {
  entries.delete(key);
  entries.set(key, { key, items: [...items], storedAt: now });

  while (entries.size > MAX_ENTRIES) {
    const oldestKey = entries.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    entries.delete(oldestKey);
  }
}

export function clearLocalBusinessDiscoveryCache() {
  entries.clear();
}
