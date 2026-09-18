import { distanceMeters } from './businessSnapshot.js';

export type LocalPlaceSnapshotRecord = {
  id: string;
  record_class?: 'production' | 'sample' | 'discovery_candidate';
  entity_type?: 'place' | string;
  source_entity_type?: string;
  place_type?: string;
  name: string;
  category_key?: string;
  public_listing_status?: string;
  fact_verification_status?: string;
  address?: string;
  commune?: string;
  region?: string;
  location_precision?: string;
  map_eligible?: boolean;
  location?: { lat: number; lng: number };
  service_labels?: string[];
  contact?: Record<string, string>;
  evidence?: Record<string, unknown>;
};

export type LocalPlaceSnapshot = {
  schema_version?: string;
  dataset_class?: string;
  checked_at?: string;
  items?: LocalPlaceSnapshotRecord[];
};

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isProductionPlace(item: LocalPlaceSnapshotRecord): boolean {
  return (
    item.record_class === 'production' &&
    item.entity_type === 'place' &&
    item.public_listing_status !== 'closed' &&
    item.public_listing_status !== 'removed'
  );
}

function matchesQuery(item: LocalPlaceSnapshotRecord, query?: string): boolean {
  const needle = normalize(query);
  if (!needle) return true;
  const haystack = normalize([
    item.name,
    item.place_type,
    item.category_key,
    item.address,
    item.commune,
    ...(item.service_labels ?? []),
  ].filter(Boolean).join(' '));
  return haystack.includes(needle);
}

export function findProductionPlace(
  snapshot: LocalPlaceSnapshot,
  id: string,
): LocalPlaceSnapshotRecord | undefined {
  return (snapshot.items ?? []).find(
    (item) => item.id === id && isProductionPlace(item),
  );
}

export function searchProductionPlaces(
  snapshot: LocalPlaceSnapshot,
  input: {
    latitude: number;
    longitude: number;
    radiusM: number;
    query?: string;
  },
): Array<LocalPlaceSnapshotRecord & { distance_m: number }> {
  const origin = { lat: input.latitude, lng: input.longitude };
  return (snapshot.items ?? [])
    .filter(isProductionPlace)
    .filter((item) => item.map_eligible === true)
    .filter(
      (item) =>
        Number.isFinite(item.location?.lat) && Number.isFinite(item.location?.lng),
    )
    .filter((item) => matchesQuery(item, input.query))
    .map((item) => ({
      ...item,
      distance_m: Math.round(distanceMeters(origin, item.location!)),
    }))
    .filter((item) => item.distance_m <= input.radiusM)
    .sort((a, b) => a.distance_m - b.distance_m || a.name.localeCompare(b.name));
}

export function placeToLocalSearchItem(
  item: LocalPlaceSnapshotRecord & { distance_m: number },
): Record<string, unknown> {
  return {
    entity_id: item.id,
    entity_type: 'place',
    name: item.name,
    ...(item.category_key ? { category_key: item.category_key } : {}),
    record_class: 'production',
    distance_m: item.distance_m,
    ...(item.fact_verification_status
      ? { fact_verification_status: item.fact_verification_status }
      : {}),
    ...(item.address ? { address: item.address } : {}),
    ...(item.commune ? { commune: item.commune } : {}),
    ...(item.location ? { location: item.location } : {}),
  };
}
