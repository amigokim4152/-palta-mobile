import type {
  CreateMarketListingCommand,
  CreateMarketReviewCommand,
  DiscoverMarketListingsQuery,
  MarketCursorPage,
  MarketMutationPort,
  MarketReadPort,
  SetMarketFavoriteCommand,
  StartMarketTransactionCommand,
  TransitionMarketListingCommand,
  UpdateMarketListingCommand,
} from '../../../../src/market/marketApiContract';
import {
  canTransitionMarketListing,
  isMarketListingPublic,
  type MarketListingStatus,
} from '../../../../src/market/marketLifecycle';
import type {
  MarketListingRecord,
  MarketPublicListing,
  MarketTransactionRecord,
  MarketTransactionReview,
} from '../../../../src/market/marketPersistenceContract';
import { marketPreviewListings } from './marketPreviewData';
import { marketSellerTrustPreviewByListing } from './marketPreviewTrust';
import type { MarketRuntime } from './marketRuntime';

const PREVIEW_CURRENT_USER_ID = 'preview-current-user';
const previewMediaUrls = new Map<string, string>();
const favoriteListingIds = new Set<string>();
const mutableStatuses = new Map<string, MarketListingStatus>();
const createdListings = new Map<string, MarketListingRecord>();
const transactions = new Map<string, MarketTransactionRecord>();
const reviews = new Map<string, MarketTransactionReview>();
let sequence = 100;

const publishedAtById: Record<string, string> = {
  'preview-bike-01': '2026-09-18T11:40:00Z',
  'preview-chair-02': '2026-09-18T11:15:00Z',
  'preview-camera-03': '2026-09-18T10:35:00Z',
  'preview-shoes-04': '2026-09-18T09:40:00Z',
  'preview-free-05': '2026-09-18T08:40:00Z',
};

function nextId(prefix: string): string {
  sequence += 1;
  return `preview-${prefix}-${sequence}`;
}

function previewRecord(id: string): MarketListingRecord | undefined {
  const item = marketPreviewListings.find((candidate) => candidate.id === id);
  if (!item) return createdListings.get(id);

  const trust = marketSellerTrustPreviewByListing[item.id];
  const mediaAssetId = `preview-media:${item.id}`;
  previewMediaUrls.set(mediaAssetId, item.imageUrl);

  return {
    id: item.id,
    sellerUserId: trust?.sellerActorId ?? `preview-seller:${item.id}`,
    title: item.title,
    description: item.description,
    category: item.category,
    tradeMode: item.tradeMode,
    ...(typeof item.priceClp === 'number' ? { priceClp: item.priceClp } : {}),
    status: mutableStatuses.get(item.id) ?? item.status,
    location: { comunaName: item.comuna },
    media: [{ mediaAssetId, sortOrder: 0, altText: item.title }],
    createdAt: publishedAtById[item.id] ?? '2026-09-18T08:00:00Z',
    updatedAt: '2026-09-18T12:00:00Z',
    publishedAt: publishedAtById[item.id] ?? '2026-09-18T08:00:00Z',
    version: 1,
  };
}

function allRecords(): MarketListingRecord[] {
  const preview = marketPreviewListings
    .map((item) => previewRecord(item.id))
    .filter((item): item is MarketListingRecord => Boolean(item));
  return [...preview, ...createdListings.values()];
}

function toPublicListing(record: MarketListingRecord): MarketPublicListing {
  const preview = marketPreviewListings.find((item) => item.id === record.id);
  const trust = marketSellerTrustPreviewByListing[record.id];

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    category: record.category,
    tradeMode: record.tradeMode,
    ...(typeof record.priceClp === 'number' ? { priceClp: record.priceClp } : {}),
    status: record.status,
    location: record.location,
    media: record.media,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.publishedAt ? { publishedAt: record.publishedAt } : {}),
    seller: {
      sellerUserId: record.sellerUserId,
      displayName: preview?.sellerName ?? 'Tú',
      neighborhoodVerified: trust?.neighborhoodVerified ?? true,
      completedTrades: trust?.completedTrades ?? 0,
      ...(trust?.responseLabel ? { responseLabel: trust.responseLabel } : {}),
    },
    favoriteCount:
      (preview?.favorites ?? 0) + (favoriteListingIds.has(record.id) ? 1 : 0),
    ...(typeof preview?.chats === 'number' ? { chatCount: preview.chats } : {}),
    ...(typeof preview?.distanceKm === 'number'
      ? { distanceKm: preview.distanceKm }
      : {}),
  };
}

function paginate<T>(items: T[], cursor?: string, limit = 30): MarketCursorPage<T> {
  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const safeOffset = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const pageItems = items.slice(safeOffset, safeOffset + safeLimit);
  const nextOffset = safeOffset + pageItems.length;
  return {
    items: pageItems,
    ...(nextOffset < items.length ? { nextCursor: String(nextOffset) } : {}),
  };
}

function sortDiscovery(
  records: MarketPublicListing[],
  sort: DiscoverMarketListingsQuery['sort'],
): MarketPublicListing[] {
  const next = [...records];
  if (sort === 'distance') {
    return next.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }
  if (sort === 'price_asc' || sort === 'price_desc') {
    const direction = sort === 'price_asc' ? 1 : -1;
    return next.sort(
      (a, b) => ((a.priceClp ?? Infinity) - (b.priceClp ?? Infinity)) * direction,
    );
  }
  return next.sort((a, b) =>
    (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt),
  );
}

const read: MarketReadPort = {
  async discover(query) {
    const normalized = query.query?.trim().toLocaleLowerCase('es-CL') ?? '';
    let items = allRecords()
      .filter((record) => isMarketListingPublic(record.status))
      .map(toPublicListing)
      .filter((listing) => {
        if (query.category && listing.category !== query.category) return false;
        if (query.tradeMode && listing.tradeMode !== query.tradeMode) return false;
        if (query.comunaCode && listing.location.comunaCode !== query.comunaCode) {
          return false;
        }
        if (
          normalized &&
          !listing.title.toLocaleLowerCase('es-CL').includes(normalized) &&
          !listing.description.toLocaleLowerCase('es-CL').includes(normalized) &&
          !listing.location.comunaName.toLocaleLowerCase('es-CL').includes(normalized)
        ) {
          return false;
        }
        return true;
      });
    items = sortDiscovery(items, query.sort ?? 'recent');
    return paginate(items, query.cursor, query.limit);
  },

  async getPublicListing(listingId) {
    const record = previewRecord(listingId);
    if (!record || !isMarketListingPublic(record.status)) return null;
    return toPublicListing(record);
  },

  async listMyListings(input) {
    let items = [...createdListings.values()];
    if (input?.statuses?.length) {
      const statuses = new Set(input.statuses);
      items = items.filter((listing) => statuses.has(listing.status));
    }
    return paginate(items, input?.cursor, input?.limit);
  },

  async getMyFavoriteState(listingId) {
    return favoriteListingIds.has(listingId);
  },

  async listMyTransactions(input) {
    return paginate([...transactions.values()], input?.cursor, input?.limit);
  },
};

const mutation: MarketMutationPort = {
  async createListing(command: CreateMarketListingCommand) {
    const id = nextId('listing');
    const now = new Date().toISOString();
    const record: MarketListingRecord = {
      id,
      sellerUserId: PREVIEW_CURRENT_USER_ID,
      title: command.title.trim(),
      description: command.description.trim(),
      category: command.category,
      tradeMode: command.tradeMode,
      ...(typeof command.priceClp === 'number' ? { priceClp: command.priceClp } : {}),
      status: command.publish ? 'active' : 'draft',
      location: command.location,
      media: command.mediaAssetIds.map((mediaAssetId, sortOrder) => ({
        mediaAssetId,
        sortOrder,
      })),
      createdAt: now,
      updatedAt: now,
      ...(command.publish ? { publishedAt: now } : {}),
      version: 1,
    };
    createdListings.set(id, record);
    return record;
  },

  async updateListing(command: UpdateMarketListingCommand) {
    const current = createdListings.get(command.listingId);
    if (!current) throw new Error('Preview listing not found.');
    if (current.version !== command.expectedVersion) {
      throw new Error('Preview listing version conflict.');
    }
    const updated: MarketListingRecord = {
      ...current,
      ...command.patch,
      ...(command.patch.mediaAssetIds
        ? {
            media: command.patch.mediaAssetIds.map((mediaAssetId, sortOrder) => ({
              mediaAssetId,
              sortOrder,
            })),
          }
        : {}),
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
    delete (updated as MarketListingRecord & { mediaAssetIds?: string[] }).mediaAssetIds;
    createdListings.set(updated.id, updated);
    return updated;
  },

  async transitionListing(command: TransitionMarketListingCommand) {
    const created = createdListings.get(command.listingId);
    const current = created ?? previewRecord(command.listingId);
    if (!current) throw new Error('Preview listing not found.');
    if (!canTransitionMarketListing(current.status, command.toStatus)) {
      throw new Error('Invalid preview listing transition.');
    }
    if (created && created.version !== command.expectedVersion) {
      throw new Error('Preview listing version conflict.');
    }
    if (created) {
      const updated: MarketListingRecord = {
        ...created,
        status: command.toStatus,
        updatedAt: new Date().toISOString(),
        version: created.version + 1,
      };
      createdListings.set(updated.id, updated);
      return updated;
    }
    mutableStatuses.set(command.listingId, command.toStatus);
    return {
      ...current,
      status: command.toStatus,
      updatedAt: new Date().toISOString(),
      version: current.version + 1,
    };
  },

  async setFavorite(command: SetMarketFavoriteCommand) {
    if (command.favorite) favoriteListingIds.add(command.listingId);
    else favoriteListingIds.delete(command.listingId);
    return { favorite: favoriteListingIds.has(command.listingId) };
  },

  async startTransaction(command: StartMarketTransactionCommand) {
    const listing = previewRecord(command.listingId);
    if (!listing) throw new Error('Preview listing not found.');
    const id = nextId('transaction');
    const now = new Date().toISOString();
    const transaction: MarketTransactionRecord = {
      id,
      listingId: listing.id,
      sellerUserId: listing.sellerUserId,
      buyerUserId: PREVIEW_CURRENT_USER_ID,
      status: 'coordinating',
      ...(command.conversationId ? { conversationId: command.conversationId } : {}),
      createdAt: now,
      updatedAt: now,
    };
    transactions.set(id, transaction);
    return transaction;
  },

  async reserveTransaction(command) {
    const current = transactions.get(command.transactionId);
    if (!current) throw new Error('Preview transaction not found.');
    const updated = {
      ...current,
      status: 'reserved' as const,
      updatedAt: new Date().toISOString(),
    };
    transactions.set(updated.id, updated);
    return updated;
  },

  async completeTransaction(command) {
    const current = transactions.get(command.transactionId);
    if (!current) throw new Error('Preview transaction not found.');
    const now = new Date().toISOString();
    const updated: MarketTransactionRecord = {
      ...current,
      status: 'completed',
      updatedAt: now,
      completedAt: now,
    };
    transactions.set(updated.id, updated);
    return updated;
  },

  async cancelTransaction(command) {
    const current = transactions.get(command.transactionId);
    if (!current) throw new Error('Preview transaction not found.');
    const updated = {
      ...current,
      status: 'cancelled' as const,
      updatedAt: new Date().toISOString(),
    };
    transactions.set(updated.id, updated);
    return updated;
  },

  async createReview(command: CreateMarketReviewCommand) {
    const transaction = transactions.get(command.transactionId);
    if (!transaction || transaction.status !== 'completed') {
      throw new Error('Preview transaction is not reviewable.');
    }
    const id = nextId('review');
    const review: MarketTransactionReview = {
      id,
      transactionId: transaction.id,
      reviewerUserId: PREVIEW_CURRENT_USER_ID,
      revieweeUserId: transaction.sellerUserId,
      tags: [...command.tags],
      createdAt: new Date().toISOString(),
    };
    reviews.set(id, review);
    return review;
  },
};

export function createMarketDevelopmentRuntime(): MarketRuntime {
  return {
    mode: 'development_preview',
    read,
    mutation,
    resolveMediaAssetUrl(mediaAssetId) {
      return previewMediaUrls.get(mediaAssetId);
    },
  };
}
