import type {
  MarketCategoryKey,
  MarketTradeMode,
} from './marketCatalog.js';
import type { MarketListingStatus } from './marketLifecycle.js';

export type MarketId = string;
export type PaltaUserId = string;
export type IsoDateTime = string;

export type MarketLocationSummary = {
  comunaCode?: string;
  comunaName: string;
  areaRef?: string;
};

export type MarketMediaRef = {
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

export type MarketTransactionRecord = {
  id: MarketId;
  listingId: MarketId;
  sellerUserId: PaltaUserId;
  buyerUserId: PaltaUserId;
  status: MarketTransactionStatus;
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
