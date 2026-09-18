export type BusinessSnapshotRecord = {
  id: string;
  entity_type?: string;
  name: string;
  brand?: string;
  category_key?: string;
  record_class?: 'production' | 'sample' | 'discovery_candidate';
  public_listing_status?: string;
  verification_status?: string;
  fact_verification_status?: string;
  owner_verification_status?: string;
  address?: string;
  commune?: string;
  region?: string;
  location_precision?: string;
  map_eligible?: boolean;
  location?: { lat: number; lng: number };
  parking?: string;
  hours?: unknown[];
  hours_raw?: string[];
  hours_summary?: string;
  hours_note?: string;
  service_labels?: string[];
  contact?: Record<string, string>;
  enabled_capabilities?: string[];
  evidence?: Record<string, unknown>;
  field_verification_status?: string;
};

export type BusinessSnapshot = {
  schema_version?: string;
  checked_at?: string;
  items?: BusinessSnapshotRecord[];
};

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const earthRadiusM = 6_371_000;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadiusM * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function isProductionBusiness(
  item: BusinessSnapshotRecord,
): boolean {
  return (
    item.record_class === 'production' &&
    item.entity_type !== 'place' &&
    item.public_listing_status !== 'closed' &&
    item.public_listing_status !== 'removed'
  );
}

function matchesQuery(item: BusinessSnapshotRecord, query?: string): boolean {
  const needle = normalize(query);
  if (!needle) return true;
  const haystack = normalize([
    item.name,
    item.brand,
    item.category_key,
    item.address,
    item.commune,
    ...(item.service_labels ?? []),
  ].filter(Boolean).join(' '));
  return haystack.includes(needle);
}

export function findProductionBusiness(
  snapshot: BusinessSnapshot,
  id: string,
): BusinessSnapshotRecord | undefined {
  return (snapshot.items ?? []).find(
    (item) => item.id === id && isProductionBusiness(item),
  );
}

export function searchProductionBusinesses(
  snapshot: BusinessSnapshot,
  input: {
    latitude: number;
    longitude: number;
    radiusM: number;
    query?: string;
  },
): Array<BusinessSnapshotRecord & { distance_m: number }> {
  const origin = { lat: input.latitude, lng: input.longitude };
  return (snapshot.items ?? [])
    .filter(isProductionBusiness)
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

export function toLocalSearchItem(
  item: BusinessSnapshotRecord & { distance_m: number },
): Record<string, unknown> {
  return {
    entity_id: item.id,
    entity_type: 'business',
    name: item.name,
    ...(item.category_key ? { category_key: item.category_key } : {}),
    record_class: 'production',
    distance_m: item.distance_m,
    ...(item.verification_status
      ? { verification_status: item.verification_status }
      : {}),
    ...(item.fact_verification_status
      ? { fact_verification_status: item.fact_verification_status }
      : {}),
    ...(item.owner_verification_status
      ? { owner_verification_status: item.owner_verification_status }
      : {}),
    ...(item.address ? { address: item.address } : {}),
    ...(item.commune ? { commune: item.commune } : {}),
    ...(item.location ? { location: item.location } : {}),
  };
}
