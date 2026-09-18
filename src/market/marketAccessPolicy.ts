import type { MarketListingStatus } from './marketLifecycle.js';
import type {
  MarketListingRecord,
  MarketTransactionRecord,
  PaltaUserId,
} from './marketPersistenceContract.js';

export type MarketActor = {
  userId?: PaltaUserId;
  isServiceRole?: boolean;
};

export function canReadMarketListingPublicly(status: MarketListingStatus): boolean {
  return status === 'active' || status === 'reserved';
}

export function canReadPrivateMarketListing(
  actor: MarketActor,
  listing: Pick<MarketListingRecord, 'sellerUserId'>,
): boolean {
  return Boolean(
    actor.isServiceRole ||
      (actor.userId && actor.userId === listing.sellerUserId),
  );
}

export function canMutateMarketListing(
  actor: MarketActor,
  listing: Pick<MarketListingRecord, 'sellerUserId'>,
): boolean {
  if (!actor.userId) return false;
  return Boolean(actor.isServiceRole || actor.userId === listing.sellerUserId);
}

export function canReadMarketTransaction(
  actor: MarketActor,
  transaction: Pick<MarketTransactionRecord, 'sellerUserId' | 'buyerUserId'>,
): boolean {
  if (!actor.userId) return false;
  return Boolean(
    actor.isServiceRole ||
      actor.userId === transaction.sellerUserId ||
      actor.userId === transaction.buyerUserId,
  );
}

export function canReserveMarketTransaction(
  actor: MarketActor,
  transaction: Pick<
    MarketTransactionRecord,
    'sellerUserId' | 'status'
  >,
): boolean {
  if (!actor.userId || transaction.status !== 'coordinating') return false;
  return Boolean(actor.isServiceRole || actor.userId === transaction.sellerUserId);
}

export function canCompleteMarketTransaction(
  actor: MarketActor,
  transaction: Pick<
    MarketTransactionRecord,
    'sellerUserId' | 'status'
  >,
): boolean {
  if (!actor.userId) return false;
  if (transaction.status !== 'reserved' && transaction.status !== 'coordinating') {
    return false;
  }
  return Boolean(actor.isServiceRole || actor.userId === transaction.sellerUserId);
}

export function canCancelMarketTransaction(
  actor: MarketActor,
  transaction: Pick<
    MarketTransactionRecord,
    'sellerUserId' | 'buyerUserId' | 'status'
  >,
): boolean {
  if (!actor.userId || transaction.status === 'completed') return false;
  return Boolean(
    actor.isServiceRole ||
      actor.userId === transaction.sellerUserId ||
      actor.userId === transaction.buyerUserId,
  );
}

export function canCreateMarketReview(
  actor: MarketActor,
  transaction: Pick<
    MarketTransactionRecord,
    'sellerUserId' | 'buyerUserId' | 'status'
  >,
): boolean {
  if (!actor.userId || transaction.status !== 'completed') return false;
  return (
    actor.userId === transaction.sellerUserId ||
    actor.userId === transaction.buyerUserId
  );
}
