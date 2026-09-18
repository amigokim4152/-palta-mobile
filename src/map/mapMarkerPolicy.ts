import type { MapFeature } from '../adapters/mapCore.js';

export type MapMarkerTier = 'anchor' | 'local' | 'detail';

const ANCHOR_CATEGORIES = new Set([
  'hospital',
  'clinic',
  'cesfam',
  'pharmacy',
  'school',
  'education',
  'university',
  'municipality',
  'townhall',
  'metro',
  'metro_station',
  'station',
  'bus_stop',
  'public_transport',
  'supermarket',
  'grocery',
  'fuel',
  'police',
  'fire_station',
  'park',
  'plaza',
  'feria',
]);

const LOCAL_CATEGORIES = new Set([
  'veterinary',
  'pet',
  'auto_repair',
  'home_repair',
  'bakery',
  'restaurant',
  'professional_service',
  'hotel',
]);

export function mapMarkerTier(input: {
  entityType: MapFeature['entityType'];
  categoryKey?: string;
  verificationStatus?: string;
  selected?: boolean;
}): MapMarkerTier {
  if (input.selected) return 'anchor';
  if (input.entityType === 'public_service') return 'anchor';
  if (input.entityType === 'event') return 'local';

  const category = input.categoryKey?.trim().toLowerCase();
  if (category && ANCHOR_CATEGORIES.has(category)) return 'anchor';
  if (category && LOCAL_CATEGORIES.has(category)) return 'local';
  if (input.verificationStatus === 'verified') return 'local';
  return 'detail';
}

export function markerMinZoom(tier: MapMarkerTier): number {
  switch (tier) {
    case 'anchor':
      return 12.4;
    case 'local':
      return 13.6;
    case 'detail':
      return 14.6;
  }
}
