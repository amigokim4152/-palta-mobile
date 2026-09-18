export type HomeLifeCardGeoScope =
  | 'global'
  | 'national'
  | 'local'
  | 'metro_rm'
  | 'coastal'
  | 'border'
  | 'foothill'
  | 'mountain_or_snow'
  | 'river_or_rainy'
  | 'wildfire_risk'
  | 'weather_risk';

export type HomeLifeCardParityDefinition = {
  legacyModuleKey: string;
  capabilityKey: string;
  geoScope: HomeLifeCardGeoScope;
  demoRequired: true;
  description: string;
  legacyFeatures?: readonly string[];
};

/**
 * Complete life-card/context parity inventory recovered from the legacy Base44
 * HomeLifeCard/localLifeProfiles/HomeTheme implementation.
 *
 * Product rule:
 * - full development demo may render every entry so omissions are visible;
 * - production Home projects only entries relevant to the user's effective
 *   locality/travel context and current event state;
 * - removing an entry from one locality never removes the capability itself;
 * - legacyFeatures records useful behavior that must not disappear merely
 *   because the rebuilt Home uses a different visual composition.
 */
export const HOME_LIFE_CARD_PARITY: readonly HomeLifeCardParityDefinition[] = [
  {
    legacyModuleKey: 'weather_current',
    capabilityKey: 'glance.weather',
    geoScope: 'local',
    demoRequired: true,
    description: 'Current local weather.',
    legacyFeatures: ['current_temperature', 'apparent_temperature', 'daily_min_max', 'hourly_forecast', 'sunrise_context'],
  },
  {
    legacyModuleKey: 'precipitation',
    capabilityKey: 'glance.precipitation',
    geoScope: 'local',
    demoRequired: true,
    description: 'Near-term precipitation/rain probability.',
    legacyFeatures: ['rain_now', 'next_3h_precipitation_probability'],
  },
  {
    legacyModuleKey: 'uv',
    capabilityKey: 'glance.uv',
    geoScope: 'local',
    demoRequired: true,
    description: 'Current/maximum UV context.',
    legacyFeatures: ['current_uv', 'daily_uv_max'],
  },
  { legacyModuleKey: 'air_quality', capabilityKey: 'glance.air_quality', geoScope: 'local', demoRequired: true, description: 'Local/regional air-quality state.', legacyFeatures: ['air_quality_level', 'local_environment_summary'] },
  { legacyModuleKey: 'vehicle_restriction', capabilityKey: 'today.vehicle_restriction', geoScope: 'metro_rm', demoRequired: true, description: 'Santiago/RM vehicle restriction when active.', legacyFeatures: ['restriction_digits', 'restriction_status'] },
  { legacyModuleKey: 'traffic', capabilityKey: 'today.traffic_commute', geoScope: 'local', demoRequired: true, description: 'Commute traffic/delay signal.', legacyFeatures: ['current_minutes', 'normal_minutes', 'delay_minutes', 'alternative_route', 'saving_minutes'] },
  { legacyModuleKey: 'maritime_forecast', capabilityKey: 'today.maritime_forecast', geoScope: 'coastal', demoRequired: true, description: 'Coastal maritime forecast.' },
  { legacyModuleKey: 'marejadas', capabilityKey: 'today.marine_alert', geoScope: 'coastal', demoRequired: true, description: 'Active marejadas/maritime alert.', legacyFeatures: ['official_source_link', 'active_alert_state'] },
  { legacyModuleKey: 'tide', capabilityKey: 'today.tide', geoScope: 'coastal', demoRequired: true, description: 'Tide context for relevant coastal users/places.' },
  { legacyModuleKey: 'tsunami_alert', capabilityKey: 'now.tsunami_alert', geoScope: 'coastal', demoRequired: true, description: 'Tsunami emergency alert.' },
  { legacyModuleKey: 'disaster_alert', capabilityKey: 'now.emergency_alert', geoScope: 'weather_risk', demoRequired: true, description: 'General official disaster/emergency alert.' },
  { legacyModuleKey: 'strong_wind', capabilityKey: 'now.strong_wind', geoScope: 'weather_risk', demoRequired: true, description: 'Strong-wind warning when actionable.' },
  { legacyModuleKey: 'snow_ice', capabilityKey: 'now.snow_ice', geoScope: 'mountain_or_snow', demoRequired: true, description: 'Snow/ice hazard.' },
  { legacyModuleKey: 'wildfire', capabilityKey: 'now.wildfire_alert', geoScope: 'wildfire_risk', demoRequired: true, description: 'Wildfire alert/risk event.' },
  { legacyModuleKey: 'river_flood', capabilityKey: 'now.river_flood_alert', geoScope: 'river_or_rainy', demoRequired: true, description: 'River/flood alert.' },
  { legacyModuleKey: 'mountain_pass', capabilityKey: 'today.road_condition', geoScope: 'foothill', demoRequired: true, description: 'Mountain-pass/road operating condition.', legacyFeatures: ['normal', 'precaution', 'chains_required', 'restricted', 'closed', 'official_source_link'] },
  { legacyModuleKey: 'border_crossing', capabilityKey: 'today.border_crossing', geoScope: 'border', demoRequired: true, description: 'Border-crossing operating status.', legacyFeatures: ['open_closed_restricted', 'hours', 'reason', 'official_source_link'] },
  { legacyModuleKey: 'heat_cold', capabilityKey: 'now.heat_cold', geoScope: 'weather_risk', demoRequired: true, description: 'Extreme heat/cold warning.' },
  {
    legacyModuleKey: 'fx_uf',
    capabilityKey: 'today.exchange_rate',
    geoScope: 'national',
    demoRequired: true,
    description: 'Headline FX; UF is preserved as a separate Home capability too.',
    legacyFeatures: ['usd_clp', 'personal_currency', 'personal_currency_to_clp', 'exchange_detail_route', 'market_outlook_7d', 'market_outlook_28d'],
  },
  {
    legacyModuleKey: 'uf',
    capabilityKey: 'today.uf',
    geoScope: 'national',
    demoRequired: true,
    description: 'Current UF value and trend entry.',
    legacyFeatures: ['uf_clp', 'reference_date', 'trend_1y', 'trend_3y'],
  },
  { legacyModuleKey: 'fuel', capabilityKey: 'today.fuel_nearby', geoScope: 'local', demoRequired: true, description: 'Nearby CNE fuel price/change.', legacyFeatures: ['nearby_station', 'fuel_type', 'current_price', 'previous_price', 'price_change'] },
  { legacyModuleKey: 'food_prices', capabilityKey: 'today.food_prices', geoScope: 'local', demoRequired: true, description: 'ODEPA/public food-price reference.', legacyFeatures: ['product', 'market_or_region', 'observed_price', 'observed_date'] },
  { legacyModuleKey: 'daily_brief', capabilityKey: 'today.daily_brief', geoScope: 'national', demoRequired: true, description: 'Concise Breves de hoy projection.', legacyFeatures: ['transport', 'economy', 'policy', 'society', 'safety', 'weather', 'culture'] },
  {
    legacyModuleKey: 'annual_rhythm',
    capabilityKey: 'today.chile_annual_rhythm',
    geoScope: 'national',
    demoRequired: true,
    description: 'Chile annual seasonal/cultural rhythm such as Fiestas Patrias, vendimias, winter snow season or summer holidays.',
    legacyFeatures: ['national_theme', 'regional_theme', 'season', 'event_intensity', 'culture_context'],
  },
] as const;

export function requiredLegacyLifeCardCapabilityKeys(): string[] {
  return [...new Set(HOME_LIFE_CARD_PARITY.map((entry) => entry.capabilityKey))];
}
