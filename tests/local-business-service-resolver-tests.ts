import { resolveServiceSuggestions } from '../src/business/serviceResolver.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const entries = [
  {
    serviceId: 'home.plumbing.general',
    discoveryGroupKey: 'HOME_REPAIR_MAINTENANCE',
    label: 'Gasfitería',
    aliases: ['gasfiter', 'gasfiteria', 'plomero'],
    intentPhrases: ['fuga de agua', 'cañería tapada'],
    archetypeCandidates: ['FIELD_SERVICE', 'PROJECT_QUOTE'],
  },
  {
    serviceId: 'auto.window_film',
    discoveryGroupKey: 'AUTO_MOTO_MOBILITY',
    label: 'Polarizado y láminas para vehículos',
    aliases: ['polarizado', 'lámina automotriz', 'film automotriz'],
    negativeTerms: ['casa', 'oficina', 'edificio'],
    archetypeCandidates: ['PROJECT_QUOTE'],
  },
  {
    serviceId: 'building.window_film',
    discoveryGroupKey: 'CONSTRUCTION_INSTALLATION',
    label: 'Láminas para vidrios de casas y oficinas',
    aliases: ['polarizado', 'lámina de seguridad', 'film arquitectónico'],
    negativeTerms: ['auto', 'vehículo', 'automotriz'],
    archetypeCandidates: ['PROJECT_QUOTE', 'FIELD_SERVICE'],
  },
  {
    serviceId: 'home.air_conditioning',
    discoveryGroupKey: 'HOME_REPAIR_MAINTENANCE',
    label: 'Aire acondicionado para hogar',
    aliases: ['aire acondicionado', 'climatización'],
    negativeTerms: ['auto', 'automotriz'],
    archetypeCandidates: ['FIELD_SERVICE', 'PROJECT_QUOTE'],
  },
  {
    serviceId: 'auto.air_conditioning',
    discoveryGroupKey: 'AUTO_MOTO_MOBILITY',
    label: 'Aire acondicionado automotriz',
    aliases: ['aire acondicionado automotriz', 'climatización auto'],
    negativeTerms: ['casa', 'hogar'],
    archetypeCandidates: ['PROJECT_QUOTE'],
  },
] as const;

const plumbing = resolveServiceSuggestions('Soy gasfiter y arreglo fugas de agua', entries);
assert(plumbing.suggestions[0]?.serviceId === 'home.plumbing.general', 'Chilean gasfiter wording should resolve to plumbing.');
assert(plumbing.suggestions[0]?.confidence === 'high', 'Explicit service alias should produce high confidence.');

const ambiguousFilm = resolveServiceSuggestions('Hacemos polarizado', entries);
assert(ambiguousFilm.ambiguous, 'Unqualified polarizado must remain ambiguous.');
assert(ambiguousFilm.matchedDiscoveryGroups.includes('AUTO_MOTO_MOBILITY'), 'Polarizado must retain automotive branch.');
assert(ambiguousFilm.matchedDiscoveryGroups.includes('CONSTRUCTION_INSTALLATION'), 'Polarizado must retain architectural branch.');

const autoFilm = resolveServiceSuggestions('Polarizado para autos y film automotriz', entries, {
  preferredDiscoveryGroupKeys: ['AUTO_MOTO_MOBILITY'],
});
assert(autoFilm.suggestions[0]?.serviceId === 'auto.window_film', 'Automotive context should rank automotive film first.');
assert(!autoFilm.suggestions.some((item) => item.serviceId === 'building.window_film'), 'Negative context should suppress building film for automotive wording.');

const autoAc = resolveServiceSuggestions('Reparamos aire acondicionado automotriz', entries);
assert(autoAc.suggestions[0]?.serviceId === 'auto.air_conditioning', 'Automotive A/C must not collapse into home HVAC.');
assert(!autoAc.suggestions.some((item) => item.serviceId === 'home.air_conditioning'), 'Negative context must prevent home HVAC false match.');

console.log('PASS: local business service resolver tests');
