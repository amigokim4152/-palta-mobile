export type MarketSellerTrustPreview = {
  sellerActorId: string;
  joinedLabel: string;
  completedTrades: number;
  responseLabel: string;
  neighborhoodVerified: boolean;
};

/** Development-only trust fixtures. Production values must come from Profile/Trust services. */
export const marketSellerTrustPreviewByListing: Record<
  string,
  MarketSellerTrustPreview
> = {
  'preview-bike-01': {
    sellerActorId: 'preview-user-maria',
    joinedLabel: 'En Palta desde 2026',
    completedTrades: 12,
    responseLabel: 'Suele responder en menos de 30 min',
    neighborhoodVerified: true,
  },
  'preview-chair-02': {
    sellerActorId: 'preview-user-tomas',
    joinedLabel: 'En Palta desde 2026',
    completedTrades: 7,
    responseLabel: 'Suele responder dentro del día',
    neighborhoodVerified: true,
  },
  'preview-camera-03': {
    sellerActorId: 'preview-user-diego',
    joinedLabel: 'En Palta desde 2026',
    completedTrades: 18,
    responseLabel: 'Suele responder en menos de 1 h',
    neighborhoodVerified: true,
  },
  'preview-shoes-04': {
    sellerActorId: 'preview-user-camila',
    joinedLabel: 'En Palta desde 2026',
    completedTrades: 4,
    responseLabel: 'Suele responder dentro del día',
    neighborhoodVerified: true,
  },
  'preview-free-05': {
    sellerActorId: 'preview-user-paula',
    joinedLabel: 'En Palta desde 2026',
    completedTrades: 9,
    responseLabel: 'Suele responder en menos de 2 h',
    neighborhoodVerified: true,
  },
};
