import type { MarketTransactionView } from './marketApiContract.js';
import type { MarketListingRecord } from './marketPersistenceContract.js';

export type MarketSellerCoordination = {
  coordinating: MarketTransactionView[];
  reserved?: MarketTransactionView;
  completed: MarketTransactionView[];
};

/**
 * Returns only transactions in which the authenticated user's own listing is
 * the seller side. `listMyTransactions` also contains transactions where the
 * viewer is a buyer, so listing id alone is not sufficient for seller tools.
 */
export function marketSellerCoordinationForListing(input: {
  listing: MarketListingRecord;
  transactions: readonly MarketTransactionView[];
}): MarketSellerCoordination {
  const sellerTransactions = input.transactions.filter(
    (transaction) =>
      transaction.listingId === input.listing.id &&
      transaction.sellerUserId === input.listing.sellerUserId,
  );

  const coordinating = sellerTransactions.filter(
    (transaction) => transaction.status === 'coordinating',
  );
  const reserved = sellerTransactions.find(
    (transaction) => transaction.status === 'reserved',
  );
  const completed = sellerTransactions.filter(
    (transaction) => transaction.status === 'completed',
  );

  return {
    coordinating,
    ...(reserved ? { reserved } : {}),
    completed,
  };
}

export function marketCounterpartyLabel(
  transaction: MarketTransactionView,
): string {
  const label = transaction.counterparty?.displayName.trim();
  return label || 'Interesado de Palta';
}

export function marketCounterpartyTrustLabel(
  transaction: MarketTransactionView,
): string | undefined {
  const counterparty = transaction.counterparty;
  if (!counterparty) return undefined;

  const parts: string[] = [];
  if (counterparty.neighborhoodVerified) parts.push('Barrio verificado');
  if (counterparty.completedTrades > 0) {
    parts.push(`${counterparty.completedTrades} intercambios`);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function canUseManualListingDisposition(input: {
  listing: MarketListingRecord;
  coordination: MarketSellerCoordination;
}): boolean {
  if (input.listing.status !== 'active' && input.listing.status !== 'reserved') {
    return false;
  }
  return !input.coordination.reserved && input.coordination.coordinating.length === 0;
}
