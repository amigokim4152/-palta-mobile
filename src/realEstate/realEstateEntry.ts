import type { BusinessId, ListingId, PropertyId } from './realEstateContracts';

export type RealEstateEntrySource =
  | 'negocios_category'
  | 'business_profile'
  | 'map'
  | 'home'
  | 'search'
  | 'deep_link';

export interface RealEstateEntryContext {
  source: RealEstateEntrySource;
  businessId?: BusinessId;
  propertyId?: PropertyId;
  listingId?: ListingId;
  neighborhoodId?: string;
  comunaCode?: string;
  query?: string;
}

export type RealEstateDestination =
  | { route: '/propiedades'; params?: Record<string, string> }
  | { route: '/propiedades/map'; params?: Record<string, string> }
  | { route: `/propiedades/listing/${string}`; params?: Record<string, string> }
  | { route: `/propiedades/property/${string}`; params?: Record<string, string> }
  | { route: `/business/${string}`; params?: Record<string, string> };

/**
 * Single handoff contract used by Negocios and the rest of Palta.
 * Negocios never owns Property/Listing state; it only hands context to the
 * independent Propiedades surface.
 */
export function resolveRealEstateEntry(context: RealEstateEntryContext): RealEstateDestination {
  if (context.listingId) {
    return {
      route: `/propiedades/listing/${context.listingId}`,
      params: buildContextParams(context),
    };
  }

  if (context.propertyId) {
    return {
      route: `/propiedades/property/${context.propertyId}`,
      params: buildContextParams(context),
    };
  }

  return {
    route: '/propiedades',
    params: buildContextParams(context),
  };
}

export function buildBusinessProfileDestination(businessId: BusinessId): RealEstateDestination {
  return { route: `/business/${businessId}` };
}

function buildContextParams(context: RealEstateEntryContext): Record<string, string> | undefined {
  const params: Record<string, string> = { source: context.source };

  if (context.businessId) params.businessId = context.businessId;
  if (context.neighborhoodId) params.neighborhoodId = context.neighborhoodId;
  if (context.comunaCode) params.comunaCode = context.comunaCode;
  if (context.query) params.query = context.query;

  return Object.keys(params).length > 0 ? params : undefined;
}
