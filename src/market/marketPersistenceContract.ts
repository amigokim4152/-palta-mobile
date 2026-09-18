import type {
  MarketCategoryKey,
  MarketTradeMode,
} from './marketCatalog.js';
import type { MarketListingStatus } from './marketLifecycle.js';

export type MarketId = string;
export type PaltaUserId = string;
export type IsoDateTime = string;

export type MarketLocationSummary = {
  /** Chile comuna code when available. */
  comunaCode?: string;
  comunaName: string;
  /** Optional coarse centroid/meeting-area reference. Never an exact home address. */
  areaRef?: string;
};

export type MarketMediaRef = {
  /** Reference into the shared Media Core. Mercado does not own binary storage. */
  mediaAssetId: string;
  sortOrder: number;
  altText?: string;
};

export type MarketListingRecord = {
  id: MarketId;
  sellerUserId: PaltaUserId;
  title: string;
  description: string;
  category: Exclude<MarketCategoryKey, 'all'>;
  tradeMode: MarketTradeMode;
  priceClp?: number;
  status: MarketListingStatus;
  location: MarketLocationSummary;
  media: MarketMediaRef[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  publishedAt?: IsoDateTime;
  /** Incremented on every mutation for optimistic concurrency. */
  version: number;
};

export type MarketPublicSellerSummary = {
  sellerUserId: PaltaUserId;
  displayName: string;
  neighborhoodVerified: boolean;
  completedTrades: number;
  responseLabel?: string;
};

export type MarketPublicListing = Omit<
  MarketListingRecord,
  'sellerUserId' | 'version'
> & {
  seller: MarketPublicSellerSummary;
  favoriteCount: number;
  chatCount?: number;
  /** Distance is computed for the viewer; raw user coordinates are never returned. */
  distanceKm?: number;
};

export type MarketFavoriteRecord = {
  listingId: MarketId;
  userId: PaltaUserId;
  createdAt: IsoDateTime;
};

export type MarketTransactionStatus =
  | 'coordinating'
  | 'reserved'
  | 'completed'
  | 'cancelled';

/**
 * Immutable user-facing listing context copied when a transaction starts.
 * This keeps transaction/review history understandable after the public listing
 * is sold, withdrawn or later edited, without exposing private seller fields.
 */
export type MarketTransactionListingSnapshot = {
  listingId: MarketId;
  title: string;
  category: Exclude<MarketCategoryKey, 'all'>;
  tradeMode: MarketTradeMode;
  priceClp?: number;
  comunaName: string;
  mediaAssetId?: string;
};

export type MarketTransactionRecord = {
  id: MarketId;
  listingId: MarketId;
  sellerUserId: PaltaUserId;
  buyerUserId: PaltaUserId;
  status: MarketTransactionStatus;
  listingSnapshot: MarketTransactionListingSnapshot;
  /** Optional reference owned by Message Core, never a copied conversation. */
  conversationId?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  completedAt?: IsoDateTime;
};

export type MarketReviewTag =
  | 'good_communication'
  | 'punctual'
  | 'kind'
  | 'as_described'
  | 'easy_coordination';

export type MarketTransactionReview = {
  id: MarketId;
  transactionId: MarketId;
  reviewerUserId: PaltaUserId;
  revieweeUserId: PaltaUserId;
  tags: MarketReviewTag[];
  createdAt: IsoDateTime;
};

/**
 * Explicit privacy boundary for persistence/API implementations.
 * These values must not be persisted in the public listing record or returned
 * by public Mercado discovery endpoints.
 */
export const MARKET_PUBLIC_LISTING_FORBIDDEN_FIELDS = [
  'exactAddress',
  'streetAddress',
  'phone',
  'email',
  'latitude',
  'longitude',
  'authUserId',
] as const;

export function assertMarketListingDraft(input: {
  title: string;
  description: string;
  tradeMode: MarketTradeMode;
  priceClp?: number;
  mediaAssetIds: string[];
}): void {
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length < 3 || title.length > 120) {
    throw new Error('Market listing title must be 3-120 characters.');
  }
  if (description.length > 4000) {
    throw new Error('Market listing description must be <= 4000 characters.');
  }
  if (input.mediaAssetIds.length === 0 || input.mediaAssetIds.length > 10) {
    throw new Error('Market listing must contain 1-10 Media Core assets.');
  }
  if (input.tradeMode === 'sale') {
    if (!Number.isInteger(input.priceClp) || (input.priceClp ?? 0) < 0) {
      throw new Error('Sale listings require a non-negative integer CLP price.');
    }
  } else if (input.priceClp !== undefined) {
    throw new Error('Only sale listings may persist priceClp.');
  }
}

export function canReviewMarketTransactionRecord(input: {
  transaction: MarketTransactionRecord;
  reviewerUserId: PaltaUserId;
  existingReview?: MarketTransactionReview;
}): boolean {
  if (input.transaction.status !== 'completed') return false;
  if (input.existingReview) return false;
  return (
    input.reviewerUserId === input.transaction.sellerUserId ||
    input.reviewerUserId === input.transaction.buyerUserId
  );
}
