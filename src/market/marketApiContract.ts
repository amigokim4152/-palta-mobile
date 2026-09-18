import type {
  MarketCategoryKey,
  MarketTradeMode,
} from './marketCatalog.js';
import type { MarketListingStatus } from './marketLifecycle.js';
import type {
  MarketId,
  MarketListingRecord,
  MarketLocationSummary,
  MarketPublicListing,
  MarketReviewTag,
  MarketTransactionRecord,
  MarketTransactionReview,
} from './marketPersistenceContract.js';

export type MarketApiErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'VERSION_CONFLICT'
  | 'INVALID_STATE_TRANSITION'
  | 'ALREADY_FAVORITED'
  | 'NOT_FAVORITED'
  | 'REVIEW_NOT_ALLOWED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INVALID_RESPONSE';

export type MarketApiError = {
  code: MarketApiErrorCode;
  message: string;
  retryable: boolean;
};

export type MarketCursorPage<T> = {
  items: T[];
  nextCursor?: string;
};

export type DiscoverMarketListingsQuery = {
  category?: Exclude<MarketCategoryKey, 'all'>;
  tradeMode?: MarketTradeMode;
  comunaCode?: string;
  query?: string;
  sort?: 'recent' | 'distance' | 'price_asc' | 'price_desc';
  cursor?: string;
  limit?: number;
};

export type CreateMarketListingCommand = {
  title: string;
  description: string;
  category: Exclude<MarketCategoryKey, 'all'>;
  tradeMode: MarketTradeMode;
  priceClp?: number;
  location: MarketLocationSummary;
  /** Already-uploaded assets owned by shared Media Core. */
  mediaAssetIds: string[];
  publish: boolean;
};

export type UpdateMarketListingCommand = {
  listingId: MarketId;
  expectedVersion: number;
  patch: {
    title?: string;
    description?: string;
    category?: Exclude<MarketCategoryKey, 'all'>;
    tradeMode?: MarketTradeMode;
    /** null explicitly clears a previous sale price. */
    priceClp?: number | null;
    location?: MarketLocationSummary;
    mediaAssetIds?: string[];
  };
};

export type TransitionMarketListingCommand = {
  listingId: MarketId;
  expectedVersion: number;
  toStatus: MarketListingStatus;
};

export type SetMarketFavoriteCommand = {
  listingId: MarketId;
  favorite: boolean;
};

export type StartMarketTransactionCommand = {
  listingId: MarketId;
  /** Optional Message Core conversation reference used for continuity only. */
  conversationId?: string;
};

export type ReserveMarketTransactionCommand = {
  transactionId: MarketId;
};

export type CompleteMarketTransactionCommand = {
  transactionId: MarketId;
};

export type CancelMarketTransactionCommand = {
  transactionId: MarketId;
};

export type CreateMarketReviewCommand = {
  transactionId: MarketId;
  tags: MarketReviewTag[];
};

export interface MarketReadPort {
  discover(
    query: DiscoverMarketListingsQuery,
  ): Promise<MarketCursorPage<MarketPublicListing>>;
  getPublicListing(listingId: MarketId): Promise<MarketPublicListing | null>;
  listMyListings(input?: {
    statuses?: MarketListingStatus[];
    cursor?: string;
    limit?: number;
  }): Promise<MarketCursorPage<MarketListingRecord>>;
  getMyFavoriteState(listingId: MarketId): Promise<boolean>;
  listMyTransactions(input?: {
    cursor?: string;
    limit?: number;
  }): Promise<MarketCursorPage<MarketTransactionRecord>>;
}

export interface MarketMutationPort {
  createListing(command: CreateMarketListingCommand): Promise<MarketListingRecord>;
  updateListing(command: UpdateMarketListingCommand): Promise<MarketListingRecord>;
  transitionListing(
    command: TransitionMarketListingCommand,
  ): Promise<MarketListingRecord>;
  setFavorite(command: SetMarketFavoriteCommand): Promise<{ favorite: boolean }>;
  startTransaction(
    command: StartMarketTransactionCommand,
  ): Promise<MarketTransactionRecord>;
  reserveTransaction(
    command: ReserveMarketTransactionCommand,
  ): Promise<MarketTransactionRecord>;
  completeTransaction(
    command: CompleteMarketTransactionCommand,
  ): Promise<MarketTransactionRecord>;
  cancelTransaction(
    command: CancelMarketTransactionCommand,
  ): Promise<MarketTransactionRecord>;
  createReview(command: CreateMarketReviewCommand): Promise<MarketTransactionReview>;
}

/**
 * Side-effecting Mercado calls must be authenticated Palta API operations.
 * Mobile clients never receive permission to directly mutate Mercado tables.
 */
export const MARKET_API_ROUTES = {
  discover: 'GET /v1/market/listings',
  listing: 'GET /v1/market/listings/:listingId',
  myListings: 'GET /v1/market/me/listings',
  favoriteState: 'GET /v1/market/listings/:listingId/favorite',
  myTransactions: 'GET /v1/market/me/transactions',
  createListing: 'POST /v1/market/listings',
  updateListing: 'PATCH /v1/market/listings/:listingId',
  transitionListing: 'POST /v1/market/listings/:listingId/status',
  favorite: 'PUT /v1/market/listings/:listingId/favorite',
  transactions: 'POST /v1/market/transactions',
  transactionState: 'POST /v1/market/transactions/:transactionId/status',
  reviews: 'POST /v1/market/transactions/:transactionId/reviews',
} as const;
