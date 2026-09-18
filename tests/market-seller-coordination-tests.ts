import type { MarketTransactionView } from '../src/market/marketApiContract.js';
import type { MarketListingRecord } from '../src/market/marketPersistenceContract.js';
import {
  canUseManualListingDisposition,
  marketCounterpartyLabel,
  marketCounterpartyTrustLabel,
  marketSellerCoordinationForListing,
} from '../src/market/marketSellerCoordination.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const listing: MarketListingRecord = {
  id: 'listing-seller-1',
  sellerUserId: 'seller-1',
  title: 'Silla de comedor',
  description: 'Buen estado',
  category: 'home',
  tradeMode: 'sale',
  priceClp: 25000,
  status: 'active',
  location: { comunaName: 'Providencia', comunaCode: '13123' },
  media: [{ mediaAssetId: 'media-chair', sortOrder: 0 }],
  createdAt: '2026-09-18T12:00:00Z',
  updatedAt: '2026-09-18T12:00:00Z',
  publishedAt: '2026-09-18T12:00:00Z',
  version: 1,
};

function transaction(input: {
  id: string;
  buyerUserId: string;
  status: 'coordinating' | 'reserved' | 'completed' | 'cancelled';
  sellerUserId?: string;
  listingId?: string;
  name?: string;
}): MarketTransactionView {
  const firstMedia = listing.media[0];
  return {
    id: input.id,
    listingId: input.listingId ?? listing.id,
    sellerUserId: input.sellerUserId ?? listing.sellerUserId,
    buyerUserId: input.buyerUserId,
    status: input.status,
    listingSnapshot: {
      listingId: listing.id,
      title: listing.title,
      category: listing.category,
      tradeMode: listing.tradeMode,
      ...(typeof listing.priceClp === 'number' ? { priceClp: listing.priceClp } : {}),
      comunaName: listing.location.comunaName,
      ...(firstMedia ? { mediaAssetId: firstMedia.mediaAssetId } : {}),
    },
    conversationId: `conversation-${input.buyerUserId}`,
    createdAt: '2026-09-18T12:10:00Z',
    updatedAt: '2026-09-18T12:10:00Z',
    ...(input.status === 'completed'
      ? { completedAt: '2026-09-18T13:00:00Z' }
      : {}),
    ...(input.name
      ? {
          counterparty: {
            userId: input.buyerUserId,
            displayName: input.name,
            neighborhoodVerified: true,
            completedTrades: 4,
          },
        }
      : {}),
  };
}

const first = transaction({
  id: 'tx-1',
  buyerUserId: 'buyer-1',
  status: 'coordinating',
  name: 'Camila',
});
const second = transaction({
  id: 'tx-2',
  buyerUserId: 'buyer-2',
  status: 'coordinating',
});
const unrelatedBuyerTransaction = transaction({
  id: 'tx-other',
  buyerUserId: 'seller-1',
  sellerUserId: 'another-seller',
  listingId: 'another-listing',
  status: 'coordinating',
});

const coordination = marketSellerCoordinationForListing({
  listing,
  transactions: [first, second, unrelatedBuyerTransaction],
});
assert(coordination.coordinating.length === 2, 'Seller tools must keep both buyers coordinating on the listing.');
assert(coordination.reserved === undefined, 'Coordinating chats must not imply a reservation.');
assert(
  !canUseManualListingDisposition({ listing, coordination }),
  'Manual outside-Palta disposition must stay hidden while Palta buyers are actively coordinating.',
);
assert(marketCounterpartyLabel(first) === 'Camila', 'Seller UI should use the safe counterparty projection when present.');
assert(
  marketCounterpartyTrustLabel(first) === 'Barrio verificado · 4 intercambios',
  'Seller UI should derive trust text only from the participant-safe projection.',
);
assert(
  marketCounterpartyLabel(second) === 'Interesado de Palta',
  'Missing projection must use a privacy-safe label instead of raw buyer user id.',
);

const reserved = transaction({
  id: 'tx-1',
  buyerUserId: 'buyer-1',
  status: 'reserved',
  name: 'Camila',
});
const reservedCoordination = marketSellerCoordinationForListing({
  listing: { ...listing, status: 'reserved' },
  transactions: [reserved, second],
});
assert(reservedCoordination.reserved?.id === reserved.id, 'Seller tools must identify the selected reserved transaction.');
assert(
  !canUseManualListingDisposition({
    listing: { ...listing, status: 'reserved' },
    coordination: reservedCoordination,
  }),
  'A Palta reservation must not offer a competing manual disposition path.',
);

const emptyCoordination = marketSellerCoordinationForListing({
  listing,
  transactions: [],
});
assert(
  canUseManualListingDisposition({ listing, coordination: emptyCoordination }),
  'Outside-Palta housekeeping remains available when no Palta transaction is active.',
);

console.log('PASS: Mercado seller coordination keeps buyer transactions explicit and privacy-safe');
