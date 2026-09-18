export type MarketSafetyReportReason =
  | 'suspected_scam'
  | 'prohibited_item'
  | 'spam'
  | 'harassment'
  | 'misleading_listing'
  | 'other';

export type MarketHideListingIntent = {
  action: 'hide_listing';
  sourceCore: 'market';
  subject: {
    resourceType: 'market_listing';
    listingId: string;
    sellerActorId: string;
  };
};

export type MarketReportListingIntent = {
  action: 'report_listing';
  sourceCore: 'market';
  subject: {
    resourceType: 'market_listing';
    listingId: string;
    sellerActorId: string;
  };
  reason: MarketSafetyReportReason;
};

export type MarketSafetyIntent =
  | MarketHideListingIntent
  | MarketReportListingIntent;

export function buildMarketHideListingIntent(input: {
  listingId: string;
  sellerActorId: string;
}): MarketHideListingIntent {
  return {
    action: 'hide_listing',
    sourceCore: 'market',
    subject: {
      resourceType: 'market_listing',
      listingId: input.listingId,
      sellerActorId: input.sellerActorId,
    },
  };
}

export function buildMarketReportListingIntent(input: {
  listingId: string;
  sellerActorId: string;
  reason: MarketSafetyReportReason;
}): MarketReportListingIntent {
  return {
    action: 'report_listing',
    sourceCore: 'market',
    subject: {
      resourceType: 'market_listing',
      listingId: input.listingId,
      sellerActorId: input.sellerActorId,
    },
    reason: input.reason,
  };
}
