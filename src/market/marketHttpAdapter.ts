import type {
  CancelMarketTransactionCommand,
  CompleteMarketTransactionCommand,
  CreateMarketListingCommand,
  CreateMarketReviewCommand,
  DiscoverMarketListingsQuery,
  MarketApiError,
  MarketApiErrorCode,
  MarketCursorPage,
  MarketMutationPort,
  MarketReadPort,
  ReserveMarketTransactionCommand,
  SetMarketFavoriteCommand,
  StartMarketTransactionCommand,
  TransitionMarketListingCommand,
  UpdateMarketListingCommand,
} from './marketApiContract.js';
import type { MarketCategoryKey, MarketTradeMode } from './marketCatalog.js';
import { assertMarketDiscoveryQuery } from './marketDiscovery.js';
import type { MarketListingStatus } from './marketLifecycle.js';
import type {
  MarketListingRecord,
  MarketLocationSummary,
  MarketMediaRef,
  MarketPublicListing,
  MarketPublicSellerSummary,
  MarketReviewTag,
  MarketTransactionListingSnapshot,
  MarketTransactionRecord,
  MarketTransactionReview,
  MarketTransactionStatus,
} from './marketPersistenceContract.js';
import type { MarketVerticalKey } from './marketVerticalPolicy.js';

export type MarketHttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT';
export type MarketHttpAuth = 'optional' | 'required';

export type MarketHttpRequest = {
  method: MarketHttpMethod;
  path: string;
  auth: MarketHttpAuth;
  query?: Readonly<Record<string, string | number | readonly string[] | undefined>>;
  body?: unknown;
};

export type MarketHttpResponse = {
  status: number;
  payload?: unknown;
};

/**
 * Implemented by the shared Palta runtime/composition layer.
 * Mercado deliberately does not own API base URLs, bearer-token retrieval,
 * retry policy, connectivity state, or the underlying fetch implementation.
 */
export interface MarketHttpTransport {
  request(input: MarketHttpRequest): Promise<MarketHttpResponse>;
}

const listingStatuses = new Set<MarketListingStatus>([
  'draft',
  'active',
  'reserved',
  'sold',
  'withdrawn',
]);
const transactionStatuses = new Set<MarketTransactionStatus>([
  'coordinating',
  'reserved',
  'completed',
  'cancelled',
]);
const categories = new Set<Exclude<MarketCategoryKey, 'all'>>([
  'home',
  'kids',
  'tech',
  'sports',
  'fashion',
  'hobby',
]);
const tradeModes = new Set<MarketTradeMode>([
  'sale',
  'rent',
  'free',
  'exchange',
  'wanted',
]);
const verticals = new Set<MarketVerticalKey>([
  'secondhand',
  'vehicles',
  'property',
  'local_produce',
]);
const reviewTags = new Set<MarketReviewTag>([
  'good_communication',
  'punctual',
  'kind',
  'as_described',
  'easy_coordination',
]);

const apiErrorCodes = new Set<MarketApiErrorCode>([
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_FAILED',
  'VERSION_CONFLICT',
  'INVALID_STATE_TRANSITION',
  'ALREADY_FAVORITED',
  'NOT_FAVORITED',
  'REVIEW_NOT_ALLOWED',
  'RATE_LIMITED',
  'NETWORK_ERROR',
  'SERVICE_UNAVAILABLE',
  'INVALID_RESPONSE',
]);

export class MarketHttpAdapterError extends Error {
  readonly code: MarketApiErrorCode;
  readonly retryable: boolean;
  readonly status: number | undefined;

  constructor(error: MarketApiError, status?: number) {
    super(error.message);
    this.name = 'MarketHttpAdapterError';
    this.code = error.code;
    this.retryable = error.retryable;
    this.status = status;
  }
}

function asObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidResponse(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requiredString(object: Record<string, unknown>, key: string, label: string): string {
  const value = object[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw invalidResponse(`${label}.${key} must be a non-empty string.`);
  }
  return value;
}

function optionalString(object: Record<string, unknown>, key: string): string | undefined {
  const value = object[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function requiredNumber(object: Record<string, unknown>, key: string, label: string): number {
  const value = object[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw invalidResponse(`${label}.${key} must be a finite number.`);
  }
  return value;
}

function optionalNumber(object: Record<string, unknown>, key: string): number | undefined {
  const value = object[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function requiredBoolean(object: Record<string, unknown>, key: string, label: string): boolean {
  const value = object[key];
  if (typeof value !== 'boolean') {
    throw invalidResponse(`${label}.${key} must be a boolean.`);
  }
  return value;
}

function invalidResponse(message: string): MarketHttpAdapterError {
  return new MarketHttpAdapterError({
    code: 'INVALID_RESPONSE',
    message,
    retryable: false,
  });
}

function parseCategory(value: unknown, label: string): Exclude<MarketCategoryKey, 'all'> {
  if (typeof value !== 'string' || !categories.has(value as Exclude<MarketCategoryKey, 'all'>)) {
    throw invalidResponse(`${label} contains an unknown Mercado category.`);
  }
  return value as Exclude<MarketCategoryKey, 'all'>;
}

function parseTradeMode(value: unknown, label: string): MarketTradeMode {
  if (typeof value !== 'string' || !tradeModes.has(value as MarketTradeMode)) {
    throw invalidResponse(`${label} contains an unknown Mercado trade mode.`);
  }
  return value as MarketTradeMode;
}

function parseVertical(value: unknown, label: string): MarketVerticalKey {
  if (value === undefined || value === null || value === '') return 'secondhand';
  if (typeof value !== 'string' || !verticals.has(value as MarketVerticalKey)) {
    throw invalidResponse(`${label} contains an unknown Mercado vertical.`);
  }
  return value as MarketVerticalKey;
}

function parseListingStatus(value: unknown, label: string): MarketListingStatus {
  if (typeof value !== 'string' || !listingStatuses.has(value as MarketListingStatus)) {
    throw invalidResponse(`${label} contains an unknown listing status.`);
  }
  return value as MarketListingStatus;
}

function parseTransactionStatus(value: unknown, label: string): MarketTransactionStatus {
  if (typeof value !== 'string' || !transactionStatuses.has(value as MarketTransactionStatus)) {
    throw invalidResponse(`${label} contains an unknown transaction status.`);
  }
  return value as MarketTransactionStatus;
}

function parseLocation(value: unknown, label: string): MarketLocationSummary {
  const object = asObject(value, label);
  const comunaCode = optionalString(object, 'comuna_code');
  const areaRef = optionalString(object, 'area_ref');
  return {
    comunaName: requiredString(object, 'comuna_name', label),
    ...(comunaCode ? { comunaCode } : {}),
    ...(areaRef ? { areaRef } : {}),
  };
}

function parseMedia(value: unknown, label: string): MarketMediaRef[] {
  if (!Array.isArray(value)) throw invalidResponse(`${label} must be an array.`);
  return value.map((item, index) => {
    const itemLabel = `${label}[${index}]`;
    const object = asObject(item, itemLabel);
    const altText = optionalString(object, 'alt_text');
    return {
      mediaAssetId: requiredString(object, 'media_asset_id', itemLabel),
      sortOrder: requiredNumber(object, 'sort_order', itemLabel),
      ...(altText ? { altText } : {}),
    };
  });
}

function parseSeller(value: unknown, label: string): MarketPublicSellerSummary {
  const object = asObject(value, label);
  const responseLabel = optionalString(object, 'response_label');
  const businessId = optionalString(object, 'business_id');
  return {
    sellerUserId: requiredString(object, 'seller_user_id', label),
    ...(businessId ? { businessId } : {}),
    displayName: requiredString(object, 'display_name', label),
    neighborhoodVerified: requiredBoolean(object, 'neighborhood_verified', label),
    completedTrades: requiredNumber(object, 'completed_trades', label),
    ...(responseLabel ? { responseLabel } : {}),
  };
}

export function parseMarketListingRecord(value: unknown): MarketListingRecord {
  const object = asObject(value, 'MarketListingRecord');
  const priceClp = optionalNumber(object, 'price_clp');
  const publishedAt = optionalString(object, 'published_at');
  const sellerBusinessId = optionalString(object, 'seller_business_id');
  return {
    id: requiredString(object, 'id', 'MarketListingRecord'),
    sellerUserId: requiredString(object, 'seller_user_id', 'MarketListingRecord'),
    ...(sellerBusinessId ? { sellerBusinessId } : {}),
    vertical: parseVertical(object.vertical, 'MarketListingRecord.vertical'),
    title: requiredString(object, 'title', 'MarketListingRecord'),
    description: typeof object.description === 'string' ? object.description : '',
    category: parseCategory(object.category, 'MarketListingRecord.category'),
    tradeMode: parseTradeMode(object.trade_mode, 'MarketListingRecord.trade_mode'),
    ...(priceClp !== undefined ? { priceClp } : {}),
    status: parseListingStatus(object.status, 'MarketListingRecord.status'),
    location: parseLocation(object.location, 'MarketListingRecord.location'),
    media: parseMedia(object.media, 'MarketListingRecord.media'),
    createdAt: requiredString(object, 'created_at', 'MarketListingRecord'),
    updatedAt: requiredString(object, 'updated_at', 'MarketListingRecord'),
    ...(publishedAt ? { publishedAt } : {}),
    version: requiredNumber(object, 'version', 'MarketListingRecord'),
  };
}

export function parseMarketPublicListing(value: unknown): MarketPublicListing {
  const object = asObject(value, 'MarketPublicListing');
  const priceClp = optionalNumber(object, 'price_clp');
  const publishedAt = optionalString(object, 'published_at');
  const chatCount = optionalNumber(object, 'chat_count');
  const distanceKm = optionalNumber(object, 'distance_km');
  return {
    id: requiredString(object, 'id', 'MarketPublicListing'),
    vertical: parseVertical(object.vertical, 'MarketPublicListing.vertical'),
    title: requiredString(object, 'title', 'MarketPublicListing'),
    description: typeof object.description === 'string' ? object.description : '',
    category: parseCategory(object.category, 'MarketPublicListing.category'),
    tradeMode: parseTradeMode(object.trade_mode, 'MarketPublicListing.trade_mode'),
    ...(priceClp !== undefined ? { priceClp } : {}),
    status: parseListingStatus(object.status, 'MarketPublicListing.status'),
    location: parseLocation(object.location, 'MarketPublicListing.location'),
    media: parseMedia(object.media, 'MarketPublicListing.media'),
    createdAt: requiredString(object, 'created_at', 'MarketPublicListing'),
    updatedAt: requiredString(object, 'updated_at', 'MarketPublicListing'),
    ...(publishedAt ? { publishedAt } : {}),
    seller: parseSeller(object.seller, 'MarketPublicListing.seller'),
    favoriteCount: requiredNumber(object, 'favorite_count', 'MarketPublicListing'),
    ...(chatCount !== undefined ? { chatCount } : {}),
    ...(distanceKm !== undefined ? { distanceKm } : {}),
  };
}

function parseSnapshot(value: unknown): MarketTransactionListingSnapshot {
  const object = asObject(value, 'MarketTransactionListingSnapshot');
  const priceClp = optionalNumber(object, 'price_clp');
  const mediaAssetId = optionalString(object, 'media_asset_id');
  const sellerBusinessId = optionalString(object, 'seller_business_id');
  return {
    listingId: requiredString(object, 'listing_id', 'MarketTransactionListingSnapshot'),
    vertical: parseVertical(object.vertical, 'MarketTransactionListingSnapshot.vertical'),
    ...(sellerBusinessId ? { sellerBusinessId } : {}),
    title: requiredString(object, 'title', 'MarketTransactionListingSnapshot'),
    category: parseCategory(object.category, 'MarketTransactionListingSnapshot.category'),
    tradeMode: parseTradeMode(object.trade_mode, 'MarketTransactionListingSnapshot.trade_mode'),
    ...(priceClp !== undefined ? { priceClp } : {}),
    comunaName: requiredString(object, 'comuna_name', 'MarketTransactionListingSnapshot'),
    ...(mediaAssetId ? { mediaAssetId } : {}),
  };
}

export function parseMarketTransactionRecord(value: unknown): MarketTransactionRecord {
  const object = asObject(value, 'MarketTransactionRecord');
  const conversationId = optionalString(object, 'conversation_id');
  const completedAt = optionalString(object, 'completed_at');
  return {
    id: requiredString(object, 'id', 'MarketTransactionRecord'),
    listingId: requiredString(object, 'listing_id', 'MarketTransactionRecord'),
    sellerUserId: requiredString(object, 'seller_user_id', 'MarketTransactionRecord'),
    buyerUserId: requiredString(object, 'buyer_user_id', 'MarketTransactionRecord'),
    status: parseTransactionStatus(object.status, 'MarketTransactionRecord.status'),
    listingSnapshot: parseSnapshot(object.listing_snapshot),
    ...(conversationId ? { conversationId } : {}),
    createdAt: requiredString(object, 'created_at', 'MarketTransactionRecord'),
    updatedAt: requiredString(object, 'updated_at', 'MarketTransactionRecord'),
    ...(completedAt ? { completedAt } : {}),
  };
}

export function parseMarketTransactionReview(value: unknown): MarketTransactionReview {
  const object = asObject(value, 'MarketTransactionReview');
  if (!Array.isArray(object.tags)) {
    throw invalidResponse('MarketTransactionReview.tags must be an array.');
  }
  const tags = object.tags.map((tag) => {
    if (typeof tag !== 'string' || !reviewTags.has(tag as MarketReviewTag)) {
      throw invalidResponse('MarketTransactionReview.tags contains an unknown tag.');
    }
    return tag as MarketReviewTag;
  });
  return {
    id: requiredString(object, 'id', 'MarketTransactionReview'),
    transactionId: requiredString(object, 'transaction_id', 'MarketTransactionReview'),
    reviewerUserId: requiredString(object, 'reviewer_user_id', 'MarketTransactionReview'),
    revieweeUserId: requiredString(object, 'reviewee_user_id', 'MarketTransactionReview'),
    tags,
    createdAt: requiredString(object, 'created_at', 'MarketTransactionReview'),
  };
}

function parseCursorPage<T>(
  value: unknown,
  parseItem: (item: unknown) => T,
  label: string,
): MarketCursorPage<T> {
  const object = asObject(value, label);
  if (!Array.isArray(object.items)) throw invalidResponse(`${label}.items must be an array.`);
  const nextCursor = optionalString(object, 'next_cursor');
  return {
    items: object.items.map(parseItem),
    ...(nextCursor ? { nextCursor } : {}),
  };
}

function encodeLocation(location: MarketLocationSummary): Record<string, unknown> {
  return {
    comuna_name: location.comunaName,
    ...(location.comunaCode ? { comuna_code: location.comunaCode } : {}),
    ...(location.areaRef ? { area_ref: location.areaRef } : {}),
  };
}

function encodeCreateListing(command: CreateMarketListingCommand): Record<string, unknown> {
  return {
    vertical: command.vertical ?? 'secondhand',
    ...(command.sellerBusinessId ? { seller_business_id: command.sellerBusinessId } : {}),
    title: command.title,
    description: command.description,
    category: command.category,
    trade_mode: command.tradeMode,
    ...(command.priceClp !== undefined ? { price_clp: command.priceClp } : {}),
    location: encodeLocation(command.location),
    media_asset_ids: command.mediaAssetIds,
    publish: command.publish,
  };
}

function encodeUpdateListing(command: UpdateMarketListingCommand): Record<string, unknown> {
  const patch = command.patch;
  return {
    expected_version: command.expectedVersion,
    patch: {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
      ...(patch.tradeMode !== undefined ? { trade_mode: patch.tradeMode } : {}),
      ...(patch.priceClp !== undefined ? { price_clp: patch.priceClp } : {}),
      ...(patch.location !== undefined ? { location: encodeLocation(patch.location) } : {}),
      ...(patch.mediaAssetIds !== undefined
        ? { media_asset_ids: patch.mediaAssetIds }
        : {}),
    },
  };
}

function normalizeApiError(status: number, payload: unknown): MarketApiError {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const object = payload as Record<string, unknown>;
    const code = object.code;
    if (typeof code === 'string' && apiErrorCodes.has(code as MarketApiErrorCode)) {
      return {
        code: code as MarketApiErrorCode,
        message:
          typeof object.message === 'string' && object.message.length > 0
            ? object.message
            : `Mercado API request failed with status ${status}.`,
        retryable:
          typeof object.retryable === 'boolean'
            ? object.retryable
            : status === 429 || status >= 500,
      };
    }
  }

  if (status === 401) return { code: 'AUTH_REQUIRED', message: 'Authentication required.', retryable: false };
  if (status === 403) return { code: 'FORBIDDEN', message: 'Mercado operation is not allowed.', retryable: false };
  if (status === 404) return { code: 'NOT_FOUND', message: 'Mercado resource was not found.', retryable: false };
  if (status === 409) return { code: 'VERSION_CONFLICT', message: 'Mercado data changed. Refresh and retry.', retryable: true };
  if (status === 422) return { code: 'VALIDATION_FAILED', message: 'Mercado request was rejected.', retryable: false };
  if (status === 429) return { code: 'RATE_LIMITED', message: 'Too many Mercado requests.', retryable: true };
  if (status >= 500) return { code: 'SERVICE_UNAVAILABLE', message: 'Mercado service is temporarily unavailable.', retryable: true };
  return { code: 'VALIDATION_FAILED', message: `Mercado API request failed with status ${status}.`, retryable: false };
}

async function request(
  transport: MarketHttpTransport,
  input: MarketHttpRequest,
): Promise<MarketHttpResponse> {
  try {
    return await transport.request(input);
  } catch (error) {
    if (error instanceof MarketHttpAdapterError) throw error;
    throw new MarketHttpAdapterError({
      code: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Mercado network request failed.',
      retryable: true,
    });
  }
}

async function expectSuccess(
  transport: MarketHttpTransport,
  input: MarketHttpRequest,
): Promise<unknown> {
  const response = await request(transport, input);
  if (response.status < 200 || response.status >= 300) {
    throw new MarketHttpAdapterError(normalizeApiError(response.status, response.payload), response.status);
  }
  if (response.payload === undefined) {
    throw invalidResponse(`Mercado ${input.method} ${input.path} returned no payload.`);
  }
  return response.payload;
}

function idPath(id: string): string {
  return encodeURIComponent(id);
}

export function createMarketHttpPorts(transport: MarketHttpTransport): {
  read: MarketReadPort;
  mutation: MarketMutationPort;
} {
  const read: MarketReadPort = {
    async discover(query: DiscoverMarketListingsQuery) {
      assertMarketDiscoveryQuery(query);
      const viewport = query.viewport;
      const payload = await expectSuccess(transport, {
        method: 'GET',
        path: '/v1/market/listings',
        auth: 'optional',
        query: {
          ...(query.vertical ? { vertical: query.vertical } : {}),
          ...(query.category ? { category: query.category } : {}),
          ...(query.tradeMode ? { trade_mode: query.tradeMode } : {}),
          ...(query.comunaCode ? { comuna_code: query.comunaCode } : {}),
          ...(query.areaRef ? { area_ref: query.areaRef } : {}),
          ...(query.maxDistanceKm !== undefined
            ? { max_distance_km: query.maxDistanceKm }
            : {}),
          ...(query.surface ? { surface: query.surface } : {}),
          ...(viewport
            ? {
                viewport_north: viewport.north,
                viewport_south: viewport.south,
                viewport_east: viewport.east,
                viewport_west: viewport.west,
              }
            : {}),
          ...(query.query ? { q: query.query } : {}),
          ...(query.sort ? { sort: query.sort } : {}),
          ...(query.cursor ? { cursor: query.cursor } : {}),
          ...(query.limit !== undefined ? { limit: query.limit } : {}),
        },
      });
      return parseCursorPage(payload, parseMarketPublicListing, 'Market discovery page');
    },

    async getPublicListing(listingId) {
      const response = await request(transport, {
        method: 'GET',
        path: `/v1/market/listings/${idPath(listingId)}`,
        auth: 'optional',
      });
      if (response.status === 404) return null;
      if (response.status < 200 || response.status >= 300) {
        throw new MarketHttpAdapterError(normalizeApiError(response.status, response.payload), response.status);
      }
      if (response.payload === undefined) {
        throw invalidResponse('Mercado public listing returned no payload.');
      }
      return parseMarketPublicListing(response.payload);
    },

    async listMyListings(input) {
      const payload = await expectSuccess(transport, {
        method: 'GET',
        path: '/v1/market/me/listings',
        auth: 'required',
        query: {
          ...(input?.statuses?.length ? { status: input.statuses } : {}),
          ...(input?.cursor ? { cursor: input.cursor } : {}),
          ...(input?.limit !== undefined ? { limit: input.limit } : {}),
        },
      });
      return parseCursorPage(payload, parseMarketListingRecord, 'My Mercado listings page');
    },

    async getMyFavoriteState(listingId) {
      const payload = asObject(
        await expectSuccess(transport, {
          method: 'GET',
          path: `/v1/market/listings/${idPath(listingId)}/favorite`,
          auth: 'required',
        }),
        'Market favorite state',
      );
      return requiredBoolean(payload, 'favorite', 'Market favorite state');
    },

    async listMyTransactions(input) {
      const payload = await expectSuccess(transport, {
        method: 'GET',
        path: '/v1/market/me/transactions',
        auth: 'required',
        query: {
          ...(input?.cursor ? { cursor: input.cursor } : {}),
          ...(input?.limit !== undefined ? { limit: input.limit } : {}),
        },
      });
      return parseCursorPage(payload, parseMarketTransactionRecord, 'My Mercado transactions page');
    },
  };

  const mutation: MarketMutationPort = {
    async createListing(command) {
      return parseMarketListingRecord(
        await expectSuccess(transport, {
          method: 'POST',
          path: '/v1/market/listings',
          auth: 'required',
          body: encodeCreateListing(command),
        }),
      );
    },

    async updateListing(command) {
      return parseMarketListingRecord(
        await expectSuccess(transport, {
          method: 'PATCH',
          path: `/v1/market/listings/${idPath(command.listingId)}`,
          auth: 'required',
          body: encodeUpdateListing(command),
        }),
      );
    },

    async transitionListing(command: TransitionMarketListingCommand) {
      return parseMarketListingRecord(
        await expectSuccess(transport, {
          method: 'POST',
          path: `/v1/market/listings/${idPath(command.listingId)}/status`,
          auth: 'required',
          body: {
            expected_version: command.expectedVersion,
            to_status: command.toStatus,
          },
        }),
      );
    },

    async setFavorite(command: SetMarketFavoriteCommand) {
      const payload = asObject(
        await expectSuccess(transport, {
          method: 'PUT',
          path: `/v1/market/listings/${idPath(command.listingId)}/favorite`,
          auth: 'required',
          body: { favorite: command.favorite },
        }),
        'Market favorite mutation',
      );
      return { favorite: requiredBoolean(payload, 'favorite', 'Market favorite mutation') };
    },

    async startTransaction(command: StartMarketTransactionCommand) {
      return parseMarketTransactionRecord(
        await expectSuccess(transport, {
          method: 'POST',
          path: '/v1/market/transactions',
          auth: 'required',
          body: {
            listing_id: command.listingId,
            ...(command.conversationId ? { conversation_id: command.conversationId } : {}),
          },
        }),
      );
    },

    async reserveTransaction(command: ReserveMarketTransactionCommand) {
      return parseMarketTransactionRecord(
        await expectSuccess(transport, {
          method: 'POST',
          path: `/v1/market/transactions/${idPath(command.transactionId)}/status`,
          auth: 'required',
          body: { to_status: 'reserved' },
        }),
      );
    },

    async completeTransaction(command: CompleteMarketTransactionCommand) {
      return parseMarketTransactionRecord(
        await expectSuccess(transport, {
          method: 'POST',
          path: `/v1/market/transactions/${idPath(command.transactionId)}/status`,
          auth: 'required',
          body: { to_status: 'completed' },
        }),
      );
    },

    async cancelTransaction(command: CancelMarketTransactionCommand) {
      return parseMarketTransactionRecord(
        await expectSuccess(transport, {
          method: 'POST',
          path: `/v1/market/transactions/${idPath(command.transactionId)}/status`,
          auth: 'required',
          body: { to_status: 'cancelled' },
        }),
      );
    },

    async createReview(command: CreateMarketReviewCommand) {
      return parseMarketTransactionReview(
        await expectSuccess(transport, {
          method: 'POST',
          path: `/v1/market/transactions/${idPath(command.transactionId)}/reviews`,
          auth: 'required',
          body: { tags: command.tags },
        }),
      );
    },
  };

  return { read, mutation };
}
