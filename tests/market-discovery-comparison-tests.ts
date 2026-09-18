import {
  EMPTY_MARKET_COMPARISON,
  MARKET_COMPARISON_LIMIT,
  toggleMarketComparison,
} from '../src/market/marketComparison.js';
import {
  assertMarketDiscoveryQuery,
  toMarketMapListingProjection,
} from '../src/market/marketDiscovery.js';
import type { MarketPublicListing } from '../src/market/marketPersistenceContract.js';
import {
  marketVerticalByKey,
  MERCADO_VISIBLE_VERTICALS,
} from '../src/market/marketVerticalPolicy.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(
  !('title' in marketVerticalByKey('secondhand')),
  'Canonical vertical policy must not contain localized display titles.',
);
assert(
  MERCADO_VISIBLE_VERTICALS.includes('property'),
  'Property listings must be part of Mercado listing intent.',
);
assert(
  marketVerticalByKey('property').supportedTradeModes.includes('rent'),
  'Property vertical must support rental listings.',
);
assert(
  marketVerticalByKey('vehicles').businessReferenceAllowed,
  'Vehicle listings must allow a Business reference without embedding Business.',
);

assertMarketDiscoveryQuery({
  vertical: 'property',
  surface: 'map',
  maxDistanceKm: 25,
  viewport: {
    north: -33.2,
    south: -33.7,
    east: -70.4,
    west: -70.9,
  },
});

const publicListing: MarketPublicListing = {
  id: 'property-1',
  vertical: 'property',
  title: 'Departamento',
  description: 'Arriendo',
  category: 'home',
  tradeMode: 'rent',
  priceClp: 900000,
  status: 'active',
  location: {
    comunaCode: '13114',
    comunaName: 'Las Condes',
    areaRef: 'area:las-condes:el-golf',
  },
  media: [{ mediaAssetId: 'media-1', sortOrder: 0 }],
  createdAt: '2026-09-18T12:00:00Z',
  updatedAt: '2026-09-18T12:00:00Z',
  publishedAt: '2026-09-18T12:00:00Z',
  seller: {
    sellerUserId: 'user-agent-1',
    businessId: 'business-realestate-1',
    displayName: 'Corredora Demo',
    neighborhoodVerified: true,
    completedTrades: 12,
  },
  favoriteCount: 0,
};

const mapProjection = toMarketMapListingProjection(publicListing);
assert(mapProjection.listingId === 'property-1', 'Map projection must preserve listing id.');
assert(mapProjection.businessId === 'business-realestate-1', 'Map projection may carry Business id reference.');
assert(!('latitude' in mapProjection), 'Map projection must not expose seller latitude.');
assert(!('longitude' in mapProjection), 'Map projection must not expose seller longitude.');

let selection = EMPTY_MARKET_COMPARISON;
for (let index = 1; index <= MARKET_COMPARISON_LIMIT; index += 1) {
  const result = toggleMarketComparison(selection, {
    listingId: `property-${index}`,
    vertical: 'property',
  });
  assert(result.outcome === 'added', 'Same-vertical listing must be addable to comparison.');
  selection = result.selection;
}

const overLimit = toggleMarketComparison(selection, {
  listingId: 'property-5',
  vertical: 'property',
});
assert(overLimit.outcome === 'limit_reached', 'Mobile comparison must enforce its item limit.');

const mismatch = toggleMarketComparison(selection, {
  listingId: 'vehicle-1',
  vertical: 'vehicles',
});
assert(mismatch.outcome === 'vertical_mismatch', 'Comparison must reject cross-vertical selections.');

console.log('PASS: Mercado vertical policy, map discovery privacy and comparison contracts');
