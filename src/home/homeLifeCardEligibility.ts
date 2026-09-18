import type {
  HomeLifeCardGeoScope,
  HomeLifeCardParityDefinition,
} from './homeLifeCardParity.js';

export type HomeLocalityTrait =
  | 'urban_metro'
  | 'coastal'
  | 'border'
  | 'foothill'
  | 'austral'
  | 'river_lake'
  | 'rainy_south'
  | 'high_wind'
  | 'desert'
  | 'semi_arid'
  | 'inland'
  | 'agricultural'
  | 'urban';

export type HomeLifeCardEligibilityContext = {
  localityKey?: string;
  traits?: readonly HomeLocalityTrait[];
  mode?: 'production' | 'complete_demo';
};

function hasAny(
  traits: ReadonlySet<HomeLocalityTrait>,
  candidates: readonly HomeLocalityTrait[],
): boolean {
  return candidates.some((candidate) => traits.has(candidate));
}

export function isLifeCardGeoScopeEligible(
  scope: HomeLifeCardGeoScope,
  context: HomeLifeCardEligibilityContext,
): boolean {
  if (context.mode === 'complete_demo') return true;

  const traits = new Set(context.traits ?? []);
  const hasLocality = Boolean(context.localityKey);

  switch (scope) {
    case 'global':
    case 'national':
      return true;
    case 'local':
      return hasLocality;
    case 'metro_rm':
      return traits.has('urban_metro');
    case 'coastal':
      return hasAny(traits, ['coastal', 'austral']);
    case 'border':
      return traits.has('border');
    case 'foothill':
      return traits.has('foothill');
    case 'mountain_or_snow':
      return hasAny(traits, ['foothill', 'austral']);
    case 'river_or_rainy':
      return hasAny(traits, ['river_lake', 'rainy_south']);
    case 'wildfire_risk':
      return hasAny(traits, ['foothill', 'inland', 'semi_arid']);
    case 'weather_risk':
      // Weather/event adapters still require an active geographically matched
      // event. Geo scope only prevents capability deletion; it does not create
      // an alert by itself.
      return hasLocality;
  }
}

export function eligibleLifeCardDefinitions(
  definitions: readonly HomeLifeCardParityDefinition[],
  context: HomeLifeCardEligibilityContext,
): HomeLifeCardParityDefinition[] {
  return definitions.filter((definition) =>
    isLifeCardGeoScopeEligible(definition.geoScope, context),
  );
}
