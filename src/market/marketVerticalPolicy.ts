export type MarketVerticalKey =
  | 'secondhand'
  | 'vehicles'
  | 'property'
  | 'jobs_services';

export type MarketVerticalDefinition = {
  key: MarketVerticalKey;
  title: string;
  mapUseful: boolean;
  createContextual: true;
  browseWithoutLogin: boolean;
};

/**
 * Compatibility registry for pre-existing route contracts.
 *
 * Mercado v1 UI intentionally exposes only neighborhood person-to-person goods.
 * Vehicles, property and jobs/services remain separate Palta verticals and are
 * not rendered in the Mercado feed. These legacy definitions remain temporarily
 * so older route/tests can resolve safely while those verticals are migrated.
 */
export const marketVerticals: MarketVerticalDefinition[] = [
  {
    key: 'secondhand',
    title: 'Usados',
    mapUseful: false,
    createContextual: true,
    browseWithoutLogin: true,
  },
  {
    key: 'vehicles',
    title: 'Vehículos',
    mapUseful: true,
    createContextual: true,
    browseWithoutLogin: true,
  },
  {
    key: 'property',
    title: 'Propiedades',
    mapUseful: true,
    createContextual: true,
    browseWithoutLogin: true,
  },
  {
    key: 'jobs_services',
    title: 'Empleos y servicios',
    mapUseful: true,
    createContextual: true,
    browseWithoutLogin: true,
  },
];

export const MERCADO_V1_VISIBLE_VERTICALS = ['secondhand'] as const;

export function marketVerticalByKey(
  key: MarketVerticalKey,
): MarketVerticalDefinition {
  const vertical = marketVerticals.find((item) => item.key === key);
  if (!vertical) throw new Error(`Unknown market vertical: ${key}`);
  return vertical;
}
