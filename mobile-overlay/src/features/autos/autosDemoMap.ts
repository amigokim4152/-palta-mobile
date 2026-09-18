import type { GeoPoint } from '../../../../src/adapters/mapCore';
import type { VehicleListingView } from '../../../../src/autos/autosContracts';

const LISTING_POINTS: Record<string, GeoPoint> = {
  'auto-demo-rav4-las-condes': { latitude: -33.4142, longitude: -70.5952 },
  'auto-demo-mg-zs-providencia': { latitude: -33.4286, longitude: -70.6099 },
  'auto-demo-yaris-nunoa': { latitude: -33.4569, longitude: -70.5978 },
  'auto-demo-hilux-maipu': { latitude: -33.5162, longitude: -70.7665 },
  'auto-demo-niro-vitacura': { latitude: -33.3858, longitude: -70.5731 },
};

const COMUNA_CENTERS: Record<string, GeoPoint> = {
  'Las Condes': { latitude: -33.4167, longitude: -70.5833 },
  Providencia: { latitude: -33.4314, longitude: -70.6093 },
  'Ñuñoa': { latitude: -33.4569, longitude: -70.5978 },
  'Maipú': { latitude: -33.5106, longitude: -70.7575 },
  Vitacura: { latitude: -33.3844, longitude: -70.5758 },
  Santiago: { latitude: -33.4489, longitude: -70.6693 },
};

export const AUTOS_SANTIAGO_MAP_CENTER: GeoPoint = {
  latitude: -33.4489,
  longitude: -70.6693,
};

/**
 * Demo-only projection from a vehicle listing to the shared Map Core.
 * Production coordinates must come from Place/address context rather than
 * becoming another source of truth inside Autos.
 */
export function autosDemoPointForListing(item: VehicleListingView): GeoPoint {
  return (
    LISTING_POINTS[item.listing.id] ??
    COMUNA_CENTERS[item.listing.comuna] ??
    AUTOS_SANTIAGO_MAP_CENTER
  );
}
