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
  neighborhoodId?: string;
  comunaCode?: string;
  query?: string;
}

export type AutosDestination =
  | { route: '/autos'; params?: Record<string, string> }
  | { route: '/market/vehicles'; params?: Record<string, string> }
  | { route: `/business/${string}`; params?: Record<string, string> };

/**
 * Canonical handoff into the independent Autos vertical.
 * Negocios owns Business identity, not vehicle listing state.
 */
export function resolveAutosEntry(context: AutosEntryContext): AutosDestination {
  return {
    route: '/autos',
    params: buildContextParams(context),
  };
}

export function buildAutosBusinessDestination(businessId: string): AutosDestination {
  return { route: `/business/${businessId}` };
}

function buildContextParams(context: AutosEntryContext): Record<string, string> | undefined {
  const params: Record<string, string> = { source: context.source };

  if (context.businessId) params.businessId = context.businessId;
  if (context.neighborhoodId) params.neighborhoodId = context.neighborhoodId;
  if (context.comunaCode) params.comunaCode = context.comunaCode;
  if (context.query) params.query = context.query;

  return Object.keys(params).length > 0 ? params : undefined;
}
