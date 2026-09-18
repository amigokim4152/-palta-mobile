export type MarketVerticalKey =
  | 'secondhand'
  | 'vehicles'
  | 'property'
  | 'jobs_services';

export type MarketVerticalDefinition = {
  key: MarketVerticalKey;
  mapUseful: boolean;
  createContextual: true;
  browseWithoutLogin: boolean;
};

export const marketVerticals: MarketVerticalDefinition[] = [
  {
    key: 'secondhand',
    mapUseful: false,
    createContextual: true,
    browseWithoutLogin: true,
  },
  {
    key: 'vehicles',
    mapUseful: true,
    createContextual: true,
    browseWithoutLogin: true,
  },
  {
    key: 'property',
    mapUseful: true,
    createContextual: true,
    browseWithoutLogin: true,
  },
  {
    key: 'jobs_services',
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
