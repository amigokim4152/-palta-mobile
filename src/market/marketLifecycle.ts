export type MarketListingStatus =
  | 'draft'
  | 'active'
  | 'reserved'
  | 'sold'
  | 'withdrawn';

export const marketListingStatusMeta: Record<
  MarketListingStatus,
  { label: string; visibleInPublicFeed: boolean }
> = {
  draft: { label: 'Borrador', visibleInPublicFeed: false },
  active: { label: 'Disponible', visibleInPublicFeed: true },
  reserved: { label: 'Reservado', visibleInPublicFeed: true },
  sold: { label: 'Vendido', visibleInPublicFeed: false },
  withdrawn: { label: 'Retirado', visibleInPublicFeed: false },
};

const allowedTransitions: Record<MarketListingStatus, MarketListingStatus[]> = {
  draft: ['active', 'withdrawn'],
  active: ['reserved', 'sold', 'withdrawn'],
  reserved: ['active', 'sold', 'withdrawn'],
  sold: [],
  withdrawn: [],
};

export function canTransitionMarketListing(
  from: MarketListingStatus,
  to: MarketListingStatus,
): boolean {
  return allowedTransitions[from].includes(to);
}

export function isMarketListingPublic(status: MarketListingStatus): boolean {
  return marketListingStatusMeta[status].visibleInPublicFeed;
}

export function canContactMarketSeller(status: MarketListingStatus): boolean {
  return status === 'active' || status === 'reserved';
}

export function canReviewMarketTransaction(status: MarketListingStatus): boolean {
  return status === 'sold';
}
