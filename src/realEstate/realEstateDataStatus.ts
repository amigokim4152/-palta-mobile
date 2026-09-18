export type RealEstateDataMode = 'live' | 'demo' | 'awaiting_source';

export type RealEstateDataCapability =
  | 'listing_inventory'
  | 'building_profile'
  | 'market_price_reference'
  | 'resident_reviews'
  | 'nearby_context'
  | 'commute_context'
  | 'saved_search_alerts'
  | 'property_calendar';

export type RealEstateDataCapabilityStatus = {
  capability: RealEstateDataCapability;
  mode: RealEstateDataMode;
  note: string;
};

/**
 * V1 explicitly distinguishes product UI readiness from production data readiness.
 * Demo content can be replaced behind these capabilities without redesigning screens.
 */
export const REAL_ESTATE_DATA_STATUS: readonly RealEstateDataCapabilityStatus[] = [
  {
    capability: 'listing_inventory',
    mode: 'demo',
    note: 'UI fixtures until owner/broker publishing and production inventory APIs are connected.',
  },
  {
    capability: 'building_profile',
    mode: 'demo',
    note: 'Schema and screen slots exist; authoritative Chile building source still needs connection.',
  },
  {
    capability: 'market_price_reference',
    mode: 'awaiting_source',
    note: 'Do not present demo estimates as official transaction prices.',
  },
  {
    capability: 'resident_reviews',
    mode: 'demo',
    note: 'Product flow can be tested before verified resident/community contribution is enabled.',
  },
  {
    capability: 'nearby_context',
    mode: 'live',
    note: 'Reuse Palta Map/Neighborhood/Business data instead of duplicating POIs in listings.',
  },
  {
    capability: 'commute_context',
    mode: 'awaiting_source',
    note: 'Connect to Palta Transport/Journey Core as its production contracts become available.',
  },
  {
    capability: 'saved_search_alerts',
    mode: 'awaiting_source',
    note: 'UI entry is allowed before persistent alert/event delivery is wired.',
  },
  {
    capability: 'property_calendar',
    mode: 'awaiting_source',
    note: 'Only publish Chile-specific deadlines after authoritative source and locality rules are verified.',
  },
] as const;
