import type { MarketTradeMode } from './marketCatalog.js';

export type MarketVerticalKey =
  | 'secondhand'
  | 'vehicles'
  | 'property'
  | 'local_produce';

export type MarketSellerKind = 'person' | 'business';
export type MarketMapMode = 'optional' | 'recommended';
export type MarketCanonicalDomain = 'autos' | 'real_estate';

export type MarketVerticalDefinition = {
  key: MarketVerticalKey;
  mapUseful: boolean;
  mapMode: MarketMapMode;
  createContextual: true;
  browseWithoutLogin: boolean;
  sellerKinds: readonly MarketSellerKind[];
  businessReferenceAllowed: boolean;
  comparisonUseful: boolean;
  supportedTradeModes: readonly MarketTradeMode[];
  /**
   * Optional canonical owner of structured vertical truth.
   * Mercado links to this domain by stable ids and never copies its object graph.
   */
  canonicalDomain?: MarketCanonicalDomain;
};

/**
 * Canonical Mercado policy is language-neutral. Display labels belong to the
 * localization/UI layer and must never be added to these definitions.
 *
 * A Mercado listing is also distinct from a canonical Business. Verticals may
 * allow an optional Business id reference, but never embed or duplicate the
 * Business object.
 *
 * Vehicles and properties also have dedicated canonical domains. Mercado owns
 * discovery/transaction intent, while Autos/Real Estate own structured vehicle
 * and physical-property facts respectively.
 */
export const marketVerticals = [
  {
    key: 'secondhand',
    mapUseful: false,
    mapMode: 'optional',
    createContextual: true,
    browseWithoutLogin: true,
    sellerKinds: ['person'],
    businessReferenceAllowed: false,
    comparisonUseful: true,
    supportedTradeModes: ['sale', 'free', 'exchange', 'wanted'],
  },
  {
    key: 'vehicles',
    mapUseful: true,
    mapMode: 'recommended',
    createContextual: true,
    browseWithoutLogin: true,
    sellerKinds: ['person', 'business'],
    businessReferenceAllowed: true,
    comparisonUseful: true,
    supportedTradeModes: ['sale'],
    canonicalDomain: 'autos',
  },
  {
    key: 'property',
    mapUseful: true,
    mapMode: 'recommended',
    createContextual: true,
    browseWithoutLogin: true,
    sellerKinds: ['person', 'business'],
    businessReferenceAllowed: true,
    comparisonUseful: true,
    supportedTradeModes: ['sale', 'rent'],
    canonicalDomain: 'real_estate',
  },
  {
    key: 'local_produce',
    mapUseful: true,
    mapMode: 'recommended',
    createContextual: true,
    browseWithoutLogin: true,
    sellerKinds: ['person', 'business'],
    businessReferenceAllowed: true,
    comparisonUseful: false,
    supportedTradeModes: ['sale'],
  },
] as const satisfies readonly MarketVerticalDefinition[];

export const MERCADO_VISIBLE_VERTICALS = [
  'secondhand',
  'vehicles',
  'property',
  'local_produce',
] as const satisfies readonly MarketVerticalKey[];

/** @deprecated Compatibility alias for older route imports. */
export const MERCADO_V1_VISIBLE_VERTICALS = MERCADO_VISIBLE_VERTICALS;

export function marketVerticalByKey(
  key: MarketVerticalKey,
): MarketVerticalDefinition {
  const vertical = marketVerticals.find((item) => item.key === key);
  if (!vertical) throw new Error(`Unknown market vertical: ${key}`);
  return vertical;
}
