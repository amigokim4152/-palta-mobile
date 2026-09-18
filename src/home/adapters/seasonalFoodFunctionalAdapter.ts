import type {
  HomeDataMode,
  HomeFunctionalItem,
} from '../homeFunctionalContract.js';

export type SeasonalFoodCategory = 'fruit' | 'vegetable' | 'seafood';

export type SeasonalFoodEntry = {
  id: string;
  name: string;
};

export type SeasonalFoodSnapshot = {
  category: SeasonalFoodCategory;
  regionKey: string;
  periodKey: string;
  items: SeasonalFoodEntry[];
  dataMode: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
  actionTarget?: string;
};

const capabilityKeyByCategory: Record<SeasonalFoodCategory, string> = {
  fruit: 'today.seasonal_fruit',
  vegetable: 'today.seasonal_vegetable',
  seafood: 'today.seasonal_seafood',
};

const titleByCategory: Record<SeasonalFoodCategory, string> = {
  fruit: 'Frutas de temporada',
  vegetable: 'Verduras de temporada',
  seafood: 'Pescados y mariscos de temporada',
};

function normalizedNames(items: SeasonalFoodEntry[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const item of items) {
    const name = item.name.trim();
    if (!name) continue;
    const key = name.toLocaleLowerCase('es-CL');
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  return names;
}

/**
 * Boundary between the canonical Food/Seasonality source and Personal Home.
 *
 * The Food domain owns seasonality facts. Home only owns admission and
 * presentation semantics. Replacing demo data later must therefore require no
 * visual rewrite: canonical snapshots enter here and become the same three
 * Home capability slots used by the development demo.
 */
export function seasonalFoodToFunctionalHome(
  snapshot: SeasonalFoodSnapshot,
): HomeFunctionalItem | null {
  if (snapshot.dataMode === 'unavailable') return null;

  const names = normalizedNames(snapshot.items);
  if (names.length === 0) return null;

  const item: HomeFunctionalItem = {
    id: `seasonal-food:${snapshot.regionKey}:${snapshot.periodKey}:${snapshot.category}`,
    capabilityKey: capabilityKeyByCategory[snapshot.category],
    surface: 'useful_today',
    kind: 'content',
    title: titleByCategory[snapshot.category],
    body: names.slice(0, 4).join(' · '),
    source: {
      domain: 'food',
      mode: snapshot.dataMode,
      observedAt: snapshot.observedAt,
      ...(snapshot.expiresAt ? { expiresAt: snapshot.expiresAt } : {}),
    },
    dedupeKey: `food:seasonal:${snapshot.regionKey}:${snapshot.periodKey}:${snapshot.category}`,
    importance: 1,
    relevance: 0.72,
  };

  if (snapshot.actionTarget) {
    item.action = {
      label: 'Ver temporada',
      kind: 'internal',
      target: snapshot.actionTarget,
    };
  }

  return item;
}
