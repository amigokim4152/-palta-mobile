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

export function marketVerticalByKey(
  key: MarketVerticalKey,
): MarketVerticalDefinition {
  const vertical = marketVerticals.find((item) => item.key === key);
  if (!vertical) throw new Error(`Unknown market vertical: ${key}`);
  return vertical;
}
