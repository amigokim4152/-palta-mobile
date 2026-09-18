export type AutosEntrySource =
  | 'negocios_category'
  | 'business_profile'
  | 'map'
  | 'home'
  | 'search'
  | 'deep_link';

export interface AutosEntryContext {
  source: AutosEntrySource;
  businessId?: string;
  listingId?: string;
  neighborhoodId?: string;
  comunaCode?: string;
  query?: string;
}

export type AutosDestination =
  | { route: '/autos'; params?: Record<string, string> }
  | { route: '/autos/sell'; params?: Record<string, string> }
  | { route: '/autos/saved'; params?: Record<string, string> }
  | { route: '/autos/mine'; params?: Record<string, string> }
  | { route: `/autos/listing/${string}`; params?: Record<string, string> }
  | { route: `/business/${string}`; params?: Record<string, string> };

/**
 * Canonical handoff into the independent Autos vertical.
 * Negocios owns Business identity, not vehicle or vehicle-listing state.
 */
export function resolveAutosEntry(context: AutosEntryContext): AutosDestination {
  const params = buildContextParams(context);

  if (context.listingId) {
    return {
      route: `/autos/listing/${context.listingId}`,
      params,
    };
  }

  return {
    route: '/autos',
    params,
  };
}

export function buildAutosBusinessDestination(businessId: string): AutosDestination {
  return { route: `/business/${businessId}` };
}

function buildContextParams(context: AutosEntryContext): Record<string, string> {
  const params: Record<string, string> = { source: context.source };

  if (context.businessId) params.businessId = context.businessId;
  if (context.neighborhoodId) params.neighborhoodId = context.neighborhoodId;
  if (context.comunaCode) params.comunaCode = context.comunaCode;
  if (context.query) params.query = context.query;

  return params;
}
