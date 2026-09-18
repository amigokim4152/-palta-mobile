export type MarketVerticalKey = 'secondhand';

export type MarketVerticalDefinition = {
  key: MarketVerticalKey;
  title: string;
  mapUseful: boolean;
  createContextual: true;
  browseWithoutLogin: boolean;
};

/**
 * Mercado is intentionally narrow in v1: person-to-person neighborhood goods.
 * Vehicles, property and jobs/services are separate Palta verticals and must not
 * be mixed into the Mercado feed merely because they can be listed.
 */
export const marketVerticals: MarketVerticalDefinition[] = [
  {
    key: 'secondhand',
    title: 'Usados',
    mapUseful: false,
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
