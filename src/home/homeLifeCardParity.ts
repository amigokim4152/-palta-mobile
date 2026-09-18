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
};

/**
 * Complete life-card parity inventory recovered from the legacy Base44
 * HomeLifeCard/localLifeProfiles implementation.
 *
 * Product rule:
 * - full development demo may render every entry so omissions are visible;
 * - production Home projects only entries relevant to the user's effective
 *   locality/travel context and current event state;
 * - removing an entry from one locality never removes the capability itself.
 */
export const HOME_LIFE_CARD_PARITY: readonly HomeLifeCardParityDefinition[] = [
  { legacyModuleKey: 'weather_current', capabilityKey: 'glance.weather', geoScope: 'local', demoRequired: true, description: 'Current local weather.' },
  { legacyModuleKey: 'precipitation', capabilityKey: 'glance.precipitation', geoScope: 'local', demoRequired: true, description: 'Near-term precipitation/rain probability.' },
  { legacyModuleKey: 'uv', capabilityKey: 'glance.uv', geoScope: 'local', demoRequired: true, description: 'Current/maximum UV context.' },
  { legacyModuleKey: 'air_quality', capabilityKey: 'glance.air_quality', geoScope: 'local', demoRequired: true, description: 'Local/regional air-quality state.' },
  { legacyModuleKey: 'vehicle_restriction', capabilityKey: 'today.vehicle_restriction', geoScope: 'metro_rm', demoRequired: true, description: 'Santiago/RM vehicle restriction when active.' },
  { legacyModuleKey: 'traffic', capabilityKey: 'today.traffic_commute', geoScope: 'local', demoRequired: true, description: 'Commute traffic/delay signal.' },
  { legacyModuleKey: 'maritime_forecast', capabilityKey: 'today.maritime_forecast', geoScope: 'coastal', demoRequired: true, description: 'Coastal maritime forecast.' },
  { legacyModuleKey: 'marejadas', capabilityKey: 'today.marine_alert', geoScope: 'coastal', demoRequired: true, description: 'Active marejadas/maritime alert.' },
  { legacyModuleKey: 'tide', capabilityKey: 'today.tide', geoScope: 'coastal', demoRequired: true, description: 'Tide context for relevant coastal users/places.' },
  { legacyModuleKey: 'tsunami_alert', capabilityKey: 'now.tsunami_alert', geoScope: 'coastal', demoRequired: true, description: 'Tsunami emergency alert.' },
  { legacyModuleKey: 'disaster_alert', capabilityKey: 'now.emergency_alert', geoScope: 'weather_risk', demoRequired: true, description: 'General official disaster/emergency alert.' },
  { legacyModuleKey: 'strong_wind', capabilityKey: 'now.strong_wind', geoScope: 'weather_risk', demoRequired: true, description: 'Strong-wind warning when actionable.' },
  { legacyModuleKey: 'snow_ice', capabilityKey: 'now.snow_ice', geoScope: 'mountain_or_snow', demoRequired: true, description: 'Snow/ice hazard.' },
  { legacyModuleKey: 'wildfire', capabilityKey: 'now.wildfire_alert', geoScope: 'wildfire_risk', demoRequired: true, description: 'Wildfire alert/risk event.' },
  { legacyModuleKey: 'river_flood', capabilityKey: 'now.river_flood_alert', geoScope: 'river_or_rainy', demoRequired: true, description: 'River/flood alert.' },
  { legacyModuleKey: 'mountain_pass', capabilityKey: 'today.road_condition', geoScope: 'foothill', demoRequired: true, description: 'Mountain-pass/road operating condition.' },
  { legacyModuleKey: 'border_crossing', capabilityKey: 'today.border_crossing', geoScope: 'border', demoRequired: true, description: 'Border-crossing operating status.' },
  { legacyModuleKey: 'heat_cold', capabilityKey: 'now.heat_cold', geoScope: 'weather_risk', demoRequired: true, description: 'Extreme heat/cold warning.' },
  { legacyModuleKey: 'fx_uf', capabilityKey: 'today.exchange_rate', geoScope: 'national', demoRequired: true, description: 'Headline FX; UF is preserved as a separate Home capability too.' },

  { legacyModuleKey: 'uf', capabilityKey: 'today.uf', geoScope: 'national', demoRequired: true, description: 'Current UF value and trend entry.' },
  { legacyModuleKey: 'fuel', capabilityKey: 'today.fuel_nearby', geoScope: 'local', demoRequired: true, description: 'Nearby CNE fuel price/change.' },
  { legacyModuleKey: 'food_prices', capabilityKey: 'today.food_prices', geoScope: 'local', demoRequired: true, description: 'ODEPA/public food-price reference.' },
  { legacyModuleKey: 'daily_brief', capabilityKey: 'today.daily_brief', geoScope: 'national', demoRequired: true, description: 'Concise Breves de hoy projection.' },
] as const;

export function requiredLegacyLifeCardCapabilityKeys(): string[] {
  return [...new Set(HOME_LIFE_CARD_PARITY.map((entry) => entry.capabilityKey))];
}
