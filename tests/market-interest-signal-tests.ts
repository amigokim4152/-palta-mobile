import {
  buildMarketInterestProfile,
  MARKET_INTEREST_MAX_SIGNALS,
  marketPriceBand,
  retainMarketInterestSignals,
  type MarketInterestSignal,
} from '../src/market/marketInterestSignal.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = Date.parse('2026-09-18T22:00:00Z');
const phoneBand = marketPriceBand(430000);
const galaxyBand = marketPriceBand(390000);
const bikeBand = marketPriceBand(120000);

const signals: MarketInterestSignal[] = [
  {
    action: 'view',
    occurredAt: '2026-09-18T21:59:00Z',
    vertical: 'secondhand',
    category: 'tech',
    productFamilyKey: 'smartphone',
    listingId: 'iphone-14',
    ...(phoneBand ? { priceBand: phoneBand } : {}),
  },
  {
    action: 'favorite',
    occurredAt: '2026-09-18T21:58:00Z',
    vertical: 'secondhand',
    category: 'tech',
    productFamilyKey: 'smartphone',
    listingId: 'galaxy-s23',
    ...(galaxyBand ? { priceBand: galaxyBand } : {}),
  },
  {
    action: 'message',
    occurredAt: '2026-09-18T21:57:00Z',
    vertical: 'secondhand',
    category: 'sports',
    productFamilyKey: 'urban_bike',
    listingId: 'bike',
    ...(bikeBand ? { priceBand: bikeBand } : {}),
  },
  {
    action: 'view',
    occurredAt: '2026-07-01T00:00:00Z',
    vertical: 'secondhand',
    category: 'home',
    productFamilyKey: 'chair',
  },
];

const retained = retainMarketInterestSignals(signals, now);
assert(retained.length === 3, 'Signals older than the retention window must be removed.');

const profile = buildMarketInterestProfile(signals, now);
assert(profile.signalCount === 3, 'Profile must report only retained signals.');
assert(
  (profile.productFamilyWeights.smartphone ?? 0) > 0,
  'Smartphone interest must survive profile aggregation.',
);
assert(
  (profile.categoryWeights.tech ?? 0) > (profile.categoryWeights.home ?? 0),
  'Expired category interest must not affect the current profile.',
);
assert(
  (profile.productFamilyWeights.urban_bike ?? 0) >
    (profile.productFamilyWeights.smartphone ?? 0) / 2,
  'High-intent message actions must carry stronger weight than a passive view.',
);
assert(marketPriceBand(28000) === 'under_50k', 'Low price band must be stable.');
assert(marketPriceBand(430000) === '400k_800k', 'Phone price band must be stable.');

const manySignals: MarketInterestSignal[] = Array.from(
  { length: MARKET_INTEREST_MAX_SIGNALS + 20 },
  (_, index) => ({
    action: 'view',
    occurredAt: new Date(now - index * 1000).toISOString(),
    vertical: 'secondhand',
    category: 'tech',
  }),
);
assert(
  retainMarketInterestSignals(manySignals, now).length === MARKET_INTEREST_MAX_SIGNALS,
  'Interest history must remain bounded.',
);

console.log('PASS: Mercado privacy-safe interest signals and bounded profile');