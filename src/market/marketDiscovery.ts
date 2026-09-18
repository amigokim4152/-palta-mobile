import type { DiscoverMarketListingsQuery, MarketMapViewport } from './marketApiContract.js';
import type { MarketPublicListing } from './marketPersistenceContract.js';
import { marketListingVerticalOf } from './marketPersistenceContract.js';
import type { MarketVerticalKey } from './marketVerticalPolicy.js';

export type MarketDiscoverySurface = 'list' | 'map';

/**
 * Privacy-safe projection consumed by the shared Map Core. Mercado supplies
 * listing identity and coarse area context only; Map Core/Location Core owns
 * geometry resolution, viewport behavior and marker rendering.
 */
export type MarketMapListingProjection = {
  listingId: string;
  vertical: MarketVerticalKey;
  areaRef?: string;
  comunaCode?: string;
  businessId?: string;
};

export function assertMarketViewport(viewport: MarketMapViewport): void {
  const values = [viewport.north, viewport.south, viewport.east, viewport.west];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('Market map viewport must contain finite coordinates.');
  }
  if (viewport.north < viewport.south) {
    throw new Error('Market map viewport north must be >= south.');
  }
  if (viewport.north > 90 || viewport.south < -90) {
    throw new Error('Market map viewport latitude is out of range.');
  }
  if (viewport.east > 180 || viewport.east < -180 || viewport.west > 180 || viewport.west < -180) {
    throw new Error('Market map viewport longitude is out of range.');
  }
}

export function assertMarketDiscoveryQuery(query: DiscoverMarketListingsQuery): void {
  if (
    query.maxDistanceKm !== undefined &&
    (!Number.isFinite(query.maxDistanceKm) || query.maxDistanceKm <= 0 || query.maxDistanceKm > 500)
  ) {
    throw new Error('Market maxDistanceKm must be > 0 and <= 500.');
  }
  if (query.viewport) assertMarketViewport(query.viewport);
}

export function toMarketMapListingProjection(
  listing: MarketPublicListing,
): MarketMapListingProjection {
  return {
    listingId: listing.id,
    vertical: marketListingVerticalOf(listing),
    ...(listing.location.areaRef ? { areaRef: listing.location.areaRef } : {}),
    ...(listing.location.comunaCode ? { comunaCode: listing.location.comunaCode } : {}),
    ...(listing.seller.businessId ? { businessId: listing.seller.businessId } : {}),
  };
}
