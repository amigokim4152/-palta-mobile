export type HomeCapabilityBindingStatus =
  | 'connected'
  | 'adapter_ready'
  | 'legacy_source_exists'
  | 'migration_pending'
  | 'pending_core'
  | 'source_policy_required';

export type HomeCapabilitySourceBinding = {
  capabilityKey: string;
  canonicalOwner: string;
  legacyBase44Assets?: readonly string[];
  targetContract: string;
  status: HomeCapabilityBindingStatus;
  notes: string;
};

/**
 * Migration binding registry for Home capabilities recovered from Base44.
 *
 * Home must never fetch a provider directly merely because a card needs data.
 * The owning domain/shared-data adapter supplies the canonical projection and
 * the Home capability key stays stable while the underlying provider/runtime
 * is migrated.
 */
export const HOME_CAPABILITY_SOURCE_BINDINGS: readonly HomeCapabilitySourceBinding[] = [
  {
    capabilityKey: 'glance.weather',
    canonicalOwner: 'Weather shared data',
    legacyBase44Assets: ['shared-location-weather', 'SharedWeatherSnapshot'],
    targetContract: '/v1/cl/environment/weather',
    status: 'adapter_ready',
    notes: 'Current weather remains area/grid based; exact GPS must not be stored merely for public weather caching.',
  },
  {
    capabilityKey: 'glance.precipitation',
    canonicalOwner: 'Weather shared data',
    legacyBase44Assets: ['shared-location-weather'],
    targetContract: '/v1/cl/environment/weather',
    status: 'adapter_ready',
    notes: 'Near-term precipitation is a weather subprojection, not a second collector.',
  },
  {
    capabilityKey: 'glance.uv',
    canonicalOwner: 'Weather shared data',
    legacyBase44Assets: ['shared-location-weather'],
    targetContract: '/v1/cl/environment/weather',
    status: 'adapter_ready',
    notes: 'UV remains part of the shared weather snapshot.',
  },
  {
    capabilityKey: 'glance.air_quality',
    canonicalOwner: 'Environment shared data',
    legacyBase44Assets: ['sync-regional-air-quality', 'RegionalAirStatus'],
    targetContract: '/v1/cl/environment/air-quality',
    status: 'legacy_source_exists',
    notes: 'Project only into Home when geographically relevant; preserve regional source freshness.',
  },
  {
    capabilityKey: 'today.vehicle_restriction',
    canonicalOwner: 'Environment + Vehicle context',
    legacyBase44Assets: ['HomeLifeCard regional environment projection'],
    targetContract: '/v1/cl/environment/vehicle-restriction',
    status: 'migration_pending',
    notes: 'Requires both an active RM restriction rule and a relevant user vehicle context.',
  },
  {
    capabilityKey: 'today.traffic_commute',
    canonicalOwner: 'Traffic/Mobility',
    legacyBase44Assets: ['TrafficStatus', 'CommuteTrafficCard'],
    targetContract: '/v1/cl/mobility/traffic',
    status: 'legacy_source_exists',
    notes: 'Normal-vs-current delay and alternative-route semantics must be preserved.',
  },
  {
    capabilityKey: 'today.maritime_forecast',
    canonicalOwner: 'Marine shared data',
    legacyBase44Assets: ['HomeLifeCard maritime module'],
    targetContract: '/v1/cl/environment/marine/forecast',
    status: 'migration_pending',
    notes: 'Coastal/austral projection only.',
  },
  {
    capabilityKey: 'today.marine_alert',
    canonicalOwner: 'Marine shared data',
    legacyBase44Assets: ['sync-marine-alerts', 'MarineAlertSnapshot'],
    targetContract: '/v1/cl/events/marine',
    status: 'legacy_source_exists',
    notes: 'Active official maritime alerts such as marejadas; coastal projection only.',
  },
  {
    capabilityKey: 'today.tide',
    canonicalOwner: 'Marine shared data',
    legacyBase44Assets: ['HomeLifeCard tide module'],
    targetContract: '/v1/cl/environment/marine/tide',
    status: 'source_policy_required',
    notes: 'Use only approved official/licensed tide data; do not infer tides from unrelated forecasts.',
  },
  {
    capabilityKey: 'now.tsunami_alert',
    canonicalOwner: 'Emergency/Event',
    legacyBase44Assets: ['UnifiedAlert', 'HomeLifeCard tsunami module'],
    targetContract: '/v1/cl/events/emergency/tsunami',
    status: 'migration_pending',
    notes: 'Safety-sensitive; only verified active events with geographic relevance may project.',
  },
  {
    capabilityKey: 'now.earthquake_alert',
    canonicalOwner: 'Emergency/Event',
    legacyBase44Assets: ['process-earthquake-alerts', 'EmergencyEvent'],
    targetContract: '/v1/cl/events/emergency/earthquake',
    status: 'legacy_source_exists',
    notes: 'Central idempotent event ingestion; no per-user provider polling.',
  },
  {
    capabilityKey: 'now.emergency_alert',
    canonicalOwner: 'Emergency/Event',
    legacyBase44Assets: ['UnifiedAlert', 'EmergencyEvent'],
    targetContract: '/v1/cl/events/emergency',
    status: 'migration_pending',
    notes: 'Generic safety fallback only when a more specific event capability does not better represent the event.',
  },
  {
    capabilityKey: 'now.strong_wind',
    canonicalOwner: 'Weather/Event',
    legacyBase44Assets: ['sync-regional-weather-hazards', 'RegionalWeatherHazardSnapshot'],
    targetContract: '/v1/cl/events/weather/wind',
    status: 'legacy_source_exists',
    notes: 'Promote only when the wind state changes what the user should do.',
  },
  {
    capabilityKey: 'now.snow_ice',
    canonicalOwner: 'Weather/Road Event',
    legacyBase44Assets: ['sync-regional-weather-hazards', 'RegionalWeatherHazardSnapshot', 'RoadConditionSnapshot'],
    targetContract: '/v1/cl/events/weather/snow-ice',
    status: 'legacy_source_exists',
    notes: 'Combine event relevance with road state; do not duplicate the road-condition card.',
  },
  {
    capabilityKey: 'now.wildfire_alert',
    canonicalOwner: 'Emergency/Event',
    legacyBase44Assets: ['UnifiedAlert'],
    targetContract: '/v1/cl/events/emergency/wildfire',
    status: 'migration_pending',
    notes: 'Requires verified location/event relevance; a regional risk profile alone must not create an alert.',
  },
  {
    capabilityKey: 'now.river_flood_alert',
    canonicalOwner: 'Emergency/Event',
    legacyBase44Assets: ['RegionalWeatherHazardSnapshot', 'UnifiedAlert'],
    targetContract: '/v1/cl/events/emergency/flood',
    status: 'migration_pending',
    notes: 'Rainy/river locality trait enables the capability but does not create an event without verified evidence.',
  },
  {
    capabilityKey: 'now.heat_cold',
    canonicalOwner: 'Weather/Event',
    legacyBase44Assets: ['HomeLifeCard heat/cold module'],
    targetContract: '/v1/cl/events/weather/temperature-extreme',
    status: 'migration_pending',
    notes: 'Only action-changing extreme heat/cold should become AHORA.',
  },
  {
    capabilityKey: 'today.road_condition',
    canonicalOwner: 'Road/Public Data',
    legacyBase44Assets: ['sync-road-conditions', 'RoadConditionSnapshot'],
    targetContract: '/v1/cl/mobility/roads',
    status: 'legacy_source_exists',
    notes: 'Preserve normal/precaution/chains/restricted/closed semantics and official source evidence.',
  },
  {
    capabilityKey: 'today.border_crossing',
    canonicalOwner: 'Border/Public Data',
    legacyBase44Assets: ['BorderCrossingStatus'],
    targetContract: '/v1/cl/mobility/border-crossings',
    status: 'legacy_source_exists',
    notes: 'Border-locality or explicit trip/interest context only; preserve hours/reason when available.',
  },
  {
    capabilityKey: 'today.exchange_rate',
    canonicalOwner: 'Economy shared snapshot',
    legacyBase44Assets: ['shared-headline-rates', 'shared-exchange-history', 'ExchangeHeadlineSnapshot', 'ExchangeHistorySnapshot', 'ExchangeForecastSnapshot'],
    targetContract: '/v1/cl/economy/exchange',
    status: 'legacy_source_exists',
    notes: 'Preserve USD/CLP, personal currency conversion, historical detail and 7d/28d outlook as separate subfeatures.',
  },
  {
    capabilityKey: 'today.uf',
    canonicalOwner: 'Economy shared snapshot',
    legacyBase44Assets: ['shared-headline-rates', 'shared-exchange-history', 'ExchangeHeadlineSnapshot', 'ExchangeHistorySnapshot'],
    targetContract: '/v1/cl/economy/uf',
    status: 'legacy_source_exists',
    notes: 'Preserve current UF and longer-term historical views; collect once nationally.',
  },
  {
    capabilityKey: 'today.fuel_nearby',
    canonicalOwner: 'Fuel shared data',
    legacyBase44Assets: ['sync-cne-fuel-stations', 'fuel-station-nearby', 'FuelStationCne', 'FuelPriceChange'],
    targetContract: '/v1/cl/fuel/nearby',
    status: 'legacy_source_exists',
    notes: 'CNE/Bencina data remains canonical source candidate subject to production/commercial data-use confirmation.',
  },
  {
    capabilityKey: 'today.food_prices',
    canonicalOwner: 'Food/ODEPA',
    legacyBase44Assets: ['public-odepa-food-prices', 'get-odepa-food-prices', 'PublicFoodPriceSnapshot', 'OdepaWholesaleSnapshot'],
    targetContract: '/v1/cl/food/prices',
    status: 'legacy_source_exists',
    notes: 'Price observations are separate from seasonal produce recommendations.',
  },
  {
    capabilityKey: 'today.seasonal_fruit',
    canonicalOwner: 'Food canonical migration',
    targetContract: 'SeasonalFoodSnapshot(category=fruit) -> Home adapter',
    status: 'adapter_ready',
    notes: 'Current demo slot waits for the independent Food migration source.',
  },
  {
    capabilityKey: 'today.seasonal_vegetable',
    canonicalOwner: 'Food canonical migration',
    targetContract: 'SeasonalFoodSnapshot(category=vegetable) -> Home adapter',
    status: 'adapter_ready',
    notes: 'Current demo slot waits for the independent Food migration source.',
  },
  {
    capabilityKey: 'today.seasonal_seafood',
    canonicalOwner: 'Food canonical migration',
    targetContract: 'SeasonalFoodSnapshot(category=seafood) -> Home adapter',
    status: 'adapter_ready',
    notes: 'Current demo slot waits for the independent Food migration source.',
  },
  {
    capabilityKey: 'today.nearby_food_available',
    canonicalOwner: 'Food + Commerce availability',
    legacyBase44Assets: ['Home LunchPreview', 'ProductVariant', 'Business'],
    targetContract: 'Food availability projection -> Home adapter',
    status: 'pending_core',
    notes: 'Preserve time-window, order-open, stock, location and sponsored-but-orderable checks. Hide the card when nothing is actually orderable.',
  },
  {
    capabilityKey: 'today.daily_brief',
    canonicalOwner: 'News/Daily Brief',
    legacyBase44Assets: ['DailyBrief', 'DailyBriefTicker'],
    targetContract: '/v1/cl/news/daily-brief',
    status: 'legacy_source_exists',
    notes: 'One concise projection; Home must not become a generic news front page.',
  },
  {
    capabilityKey: 'today.chile_annual_rhythm',
    canonicalOwner: 'Chile Life/Calendar context',
    legacyBase44Assets: ['homeThemeEngine', 'chileAnnualRhythm'],
    targetContract: 'Chile annual rhythm context -> Home projection',
    status: 'legacy_source_exists',
    notes: 'Cultural/seasonal context is distinct from an official legal public-holiday calendar.',
  },
  {
    capabilityKey: 'today.interest_personalization',
    canonicalOwner: 'Interest/Personalization',
    legacyBase44Assets: ['HomeInterestPreview', 'InterestTopic', 'UserInterest'],
    targetContract: 'Explicit interests -> relevance/personalization layer',
    status: 'legacy_source_exists',
    notes: 'Explicit user follows are inputs to prioritization; they are not a generic engagement feed.',
  },
  {
    capabilityKey: 'today.palta_notice',
    canonicalOwner: 'Palta public notices',
    legacyBase44Assets: ['Notice'],
    targetContract: '/v1/notices or future Palta notice contract',
    status: 'legacy_source_exists',
    notes: 'Public operating notices are distinct from private Notification Inbox items.',
  },
] as const;

export function homeCapabilitySourceBinding(
  capabilityKey: string,
): HomeCapabilitySourceBinding | undefined {
  return HOME_CAPABILITY_SOURCE_BINDINGS.find(
    (binding) => binding.capabilityKey === capabilityKey,
  );
}
