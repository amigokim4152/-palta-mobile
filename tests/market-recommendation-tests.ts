import {
  rankMarketRecommendations,
  type MarketRecommendationCandidate,
} from '../src/market/marketRecommendation.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const seed: MarketRecommendationCandidate = {
  listingId: 'iphone-14',
  vertical: 'secondhand',
  category: 'tech',
  tradeMode: 'sale',
  status: 'active',
  productFamilyKey: 'smartphone',
  priceClp: 430000,
  distanceKm: 1.1,
};

const ranked = rankMarketRecommendations({
  seed,
  limit: 4,
  candidates: [
    {
      listingId: 'chair-nearby',
      vertical: 'secondhand',
      category: 'home',
      tradeMode: 'sale',
      status: 'active',
      productFamilyKey: 'chair',
      priceClp: 30000,
      distanceKm: 0.2,
    },
    {
      listingId: 'galaxy-s23',
      vertical: 'secondhand',
      category: 'tech',
      tradeMode: 'sale',
      status: 'active',
      productFamilyKey: 'smartphone',
      priceClp: 390000,
      distanceKm: 2.7,
    },
    {
      listingId: 'camera-nearby',
      vertical: 'secondhand',
      category: 'tech',
      tradeMode: 'sale',
      status: 'active',
      productFamilyKey: 'camera',
      priceClp: 420000,
      distanceKm: 0.4,
    },
    {
      listingId: 'iphone-13-reserved',
      vertical: 'secondhand',
      category: 'tech',
      tradeMode: 'sale',
      status: 'reserved',
      productFamilyKey: 'smartphone',
      priceClp: 330000,
      distanceKm: 4,
    },
    {
      listingId: 'iphone-sold',
      vertical: 'secondhand',
      category: 'tech',
      tradeMode: 'sale',
      status: 'sold',
      productFamilyKey: 'smartphone',
      priceClp: 400000,
      distanceKm: 1,
    },
    {
      listingId: 'vehicle-wrong-vertical',
      vertical: 'vehicles',
      category: 'tech',
      tradeMode: 'sale',
      status: 'active',
      productFamilyKey: 'smartphone',
      priceClp: 420000,
      distanceKm: 1,
    },
  ],
});

assert(ranked.length === 3, 'Only relevant, recommendable same-vertical listings should remain.');
assert(
  ranked[0]?.listingId === 'galaxy-s23',
  'Same product family must outrank a merely same-category item even when that item is closer.',
);
assert(
  ranked[0]?.reasons.includes('same_product_family'),
  'Same-family recommendations must expose their reason.',
);
assert(
  ranked.some((item) => item.listingId === 'iphone-13-reserved'),
  'Reserved inventory may appear as a fallback when still relevant.',
);
assert(
  !ranked.some((item) => item.listingId === 'iphone-sold'),
  'Sold listings must never be recommended.',
);
assert(
  !ranked.some((item) => item.listingId === 'chair-nearby'),
  'Distance alone must never make an unrelated category recommendable.',
);
assert(
  !ranked.some((item) => item.listingId === 'vehicle-wrong-vertical'),
  'Cross-vertical recommendations must be rejected.',
);

const limited = rankMarketRecommendations({ seed, candidates: [
  { listingId: 'a', vertical: 'secondhand', category: 'tech', tradeMode: 'sale', status: 'active', productFamilyKey: 'smartphone', priceClp: 420000, distanceKm: 1 },
  { listingId: 'b', vertical: 'secondhand', category: 'tech', tradeMode: 'sale', status: 'active', productFamilyKey: 'smartphone', priceClp: 410000, distanceKm: 2 },
], limit: 1 });
assert(limited.length === 1, 'Recommendation limit must be enforced.');

console.log('PASS: Mercado deterministic recommendation ranking');
