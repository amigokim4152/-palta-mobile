export type LocationPrecision =
  | 'exact'
  | 'neighborhood'
  | 'commune'
  | 'city';

export type LocationUse =
  | 'navigation'
  | 'nearby_search'
  | 'eligibility'
  | 'analytics';

export function minimumLocationPrecision(
  use: LocationUse,
): LocationPrecision {
  switch (use) {
    case 'navigation':
      return 'exact';
    case 'nearby_search':
      return 'neighborhood';
    case 'eligibility':
      return 'commune';
    case 'analytics':
      return 'city';
  }
}
