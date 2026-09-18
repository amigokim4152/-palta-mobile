import { seasonalFoodToFunctionalHome } from '../src/home/adapters/seasonalFoodFunctionalAdapter.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const base = {
  regionKey: 'cl-rm',
  periodKey: '2026-09',
  dataMode: 'cached' as const,
  observedAt: '2026-09-18T10:00:00.000Z',
  expiresAt: '2026-09-25T10:00:00.000Z',
};

const fruit = seasonalFoodToFunctionalHome({
  ...base,
  category: 'fruit',
  items: [
    { id: 'f1', name: 'Frutilla' },
    { id: 'f2', name: 'Kiwi' },
    { id: 'f3', name: 'frutilla' },
  ],
  actionTarget: '/food/seasonal?category=fruit',
});
assert(fruit, 'Fruit snapshot should create a Home item.');
assert(fruit.capabilityKey === 'today.seasonal_fruit', 'Fruit must use the fruit capability slot.');
assert(fruit.surface === 'useful_today', 'Seasonal food belongs in PARA HOY.');
assert(fruit.body === 'Frutilla · Kiwi', 'Seasonal food names should be normalized and deduplicated.');
assert(fruit.source.domain === 'food', 'Food must retain its own source domain.');
assert(fruit.source.mode === 'cached', 'Food source mode must be preserved.');
assert(fruit.source.expiresAt === base.expiresAt, 'Food expiry must be preserved.');
assert(fruit.action?.target === '/food/seasonal?category=fruit', 'Optional detail target should be retained.');

const vegetable = seasonalFoodToFunctionalHome({
  ...base,
  category: 'vegetable',
  items: [{ id: 'v1', name: 'Alcachofa' }],
});
assert(vegetable?.capabilityKey === 'today.seasonal_vegetable', 'Vegetables need their own capability slot.');

const seafood = seasonalFoodToFunctionalHome({
  ...base,
  category: 'seafood',
  items: [{ id: 's1', name: 'Merluza' }],
});
assert(seafood?.capabilityKey === 'today.seasonal_seafood', 'Seafood needs its own capability slot.');

const empty = seasonalFoodToFunctionalHome({
  ...base,
  category: 'fruit',
  items: [],
});
assert(empty === null, 'Empty seasonal datasets must not create filler cards.');

const unavailable = seasonalFoodToFunctionalHome({
  ...base,
  category: 'seafood',
  dataMode: 'unavailable',
  items: [{ id: 's2', name: 'Reineta' }],
});
assert(unavailable === null, 'Unavailable seasonal data must never fabricate a Home card.');

console.log('PASS: Seasonal food → Home functional adapter');
