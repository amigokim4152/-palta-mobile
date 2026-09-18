import {
  canCancelMarketTransaction,
  canCompleteMarketTransaction,
  canCreateMarketReview,
  canMutateMarketListing,
  canReadMarketListingPublicly,
  canReadMarketTransaction,
  canReserveMarketTransaction,
} from '../src/market/marketAccessPolicy.js';
import {
  canContactMarketSeller,
  canReviewMarketTransaction,
  canTransitionMarketListing,
  isMarketListingPublic,
} from '../src/market/marketLifecycle.js';
import { buildMarketMessageIntent } from '../src/market/marketMessageIntent.js';
import {
  assertMarketListingDraft,
  canReviewMarketTransactionRecord,
  type MarketListingRecord,
  type MarketTransactionRecord,
} from '../src/market/marketPersistenceContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrows(fn: () => void, message: string) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, message);
}

const sellerId = 'palta-user-seller';
const buyerId = 'palta-user-buyer';
const strangerId = 'palta-user-stranger';

const listing: MarketListingRecord = {
  id: 'listing-1',
  sellerUserId: sellerId,
  title: 'Bicicleta urbana',
  description: 'Buen estado',
  category: 'sports',
  tradeMode: 'sale',
  priceClp: 120000,
  status: 'active',
  location: { comunaName: 'Vitacura', comunaCode: '13132' },
  media: [{ mediaAssetId: 'media-1', sortOrder: 0 }],
  createdAt: '2026-09-18T12:00:00Z',
  updatedAt: '2026-09-18T12:00:00Z',
  publishedAt: '2026-09-18T12:00:00Z',
  version: 1,
};

const transaction: MarketTransactionRecord = {
  id: 'transaction-1',
  listingId: listing.id,
  sellerUserId: sellerId,
  buyerUserId: buyerId,
  status: 'reserved',
  listingSnapshot: {
    listingId: listing.id,
    title: listing.title,
    category: listing.category,
    tradeMode: listing.tradeMode,
    priceClp: listing.priceClp,
    comunaName: listing.location.comunaName,
    mediaAssetId: listing.media[0]?.mediaAssetId,
  },
  conversationId: 'conversation-1',
  createdAt: '2026-09-18T12:05:00Z',
  updatedAt: '2026-09-18T12:10:00Z',
};

assert(isMarketListingPublic('active'), 'Active listing must be public.');
assert(isMarketListingPublic('reserved'), 'Reserved listing remains visible.');
assert(!isMarketListingPublic('sold'), 'Sold listing must leave public discovery.');
assert(canReadMarketListingPublicly('active'), 'Public access policy must allow active listings.');
assert(!canReadMarketListingPublicly('draft'), 'Draft must not be publicly readable.');

assert(canTransitionMarketListing('active', 'reserved'), 'Active listing may be reserved.');
assert(canTransitionMarketListing('reserved', 'active'), 'Reservation may be released.');
assert(canTransitionMarketListing('reserved', 'sold'), 'Reserved listing may be sold.');
assert(!canTransitionMarketListing('sold', 'active'), 'Sold listing is terminal.');
assert(canContactMarketSeller('reserved'), 'Reserved items may still receive questions.');
assert(canReviewMarketTransaction('sold'), 'Sold listing enables transaction review flow.');

assert(canMutateMarketListing({ userId: sellerId }, listing), 'Seller owns listing mutations.');
assert(!canMutateMarketListing({ userId: buyerId }, listing), 'Buyer cannot mutate seller listing.');
assert(!canMutateMarketListing({}, listing), 'Anonymous actor cannot mutate listing.');

assert(canReadMarketTransaction({ userId: sellerId }, transaction), 'Seller can read transaction.');
assert(canReadMarketTransaction({ userId: buyerId }, transaction), 'Buyer can read transaction.');
assert(!canReadMarketTransaction({ userId: strangerId }, transaction), 'Stranger cannot read transaction.');
assert(!canReserveMarketTransaction({ userId: sellerId }, transaction), 'Already-reserved transaction cannot be reserved twice.');
assert(canCompleteMarketTransaction({ userId: sellerId }, transaction), 'Seller may complete reserved transaction.');
assert(!canCompleteMarketTransaction({ userId: buyerId }, transaction), 'Buyer cannot unilaterally mark sold.');
assert(canCancelMarketTransaction({ userId: buyerId }, transaction), 'Buyer may cancel before completion.');
assert(
  transaction.listingSnapshot.title === listing.title,
  'Transaction must preserve immutable listing context for history/reviews.',
);

const completed: MarketTransactionRecord = {
  ...transaction,
  status: 'completed',
  completedAt: '2026-09-18T13:00:00Z',
  updatedAt: '2026-09-18T13:00:00Z',
};
assert(canCreateMarketReview({ userId: sellerId }, completed), 'Seller can review completed transaction.');
assert(canCreateMarketReview({ userId: buyerId }, completed), 'Buyer can review completed transaction.');
assert(!canCreateMarketReview({ userId: strangerId }, completed), 'Stranger cannot review transaction.');
assert(
  canReviewMarketTransactionRecord({ transaction: completed, reviewerUserId: buyerId }),
  'Completed transaction participant should be review eligible.',
);

const messageIntent = buildMarketMessageIntent({
  listingId: listing.id,
  listingTitle: listing.title,
  sellerActorId: sellerId,
  preset: 'availability',
});
assert(messageIntent.conversationType === 'transaction', 'Mercado must use transaction conversation type.');
assert(messageIntent.context.relation === 'listing', 'Mercado message context must remain listing-bound.');
assert(messageIntent.context.resourceId === listing.id, 'Message intent must carry listing id.');

assertMarketListingDraft({
  title: listing.title,
  description: listing.description,
  tradeMode: 'sale',
  priceClp: 120000,
  mediaAssetIds: ['media-1'],
});
assertThrows(
  () =>
    assertMarketListingDraft({
      title: 'No price',
      description: '',
      tradeMode: 'sale',
      mediaAssetIds: ['media-1'],
    }),
  'Sale without CLP price must be rejected.',
);
assertThrows(
  () =>
    assertMarketListingDraft({
      title: 'Gratis',
      description: '',
      tradeMode: 'free',
      priceClp: 1000,
      mediaAssetIds: ['media-1'],
    }),
  'Free listing must not persist a sale price.',
);

console.log('PASS: Mercado lifecycle, privacy, transaction snapshot and Message Core handoff contracts');
