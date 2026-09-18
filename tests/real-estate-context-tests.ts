import {
  nearbyByKind,
  realEstateContextIsFresh,
  type RealEstatePropertyContext,
} from '../src/realEstate/realEstateContext.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const context: RealEstatePropertyContext = {
  propertyId: 'property-1',
  building: {
    building: {
      id: 'building-1',
      name: 'Edificio Uno',
      placeId: 'place-building-1',
      address: {
        countryCode: 'CL',
        comunaCode: '13123',
        placeId: 'place-building-1',
      },
    },
    yearBuilt: 2018,
    floors: 12,
    unitCount: 48,
    evidence: {
      verification: 'corroborated',
      sourceId: 'building-registry:1',
      observedAt: '2026-09-18T10:00:00Z',
    },
  },
  nearby: [
    {
      kind: 'transit',
      sourceCore: 'transport',
      entityId: 'metro-pedro-de-valdivia',
      placeId: 'place-metro-pdv',
      displayLabel: 'Metro Pedro de Valdivia',
      distanceMeters: 420,
      walkingMinutes: 6,
      evidence: { verification: 'verified', sourceId: 'transport-core' },
    },
    {
      kind: 'business',
      sourceCore: 'business',
      entityId: 'business-supermarket-1',
      displayLabel: 'Supermercado cercano',
      distanceMeters: 300,
      walkingMinutes: 4,
      evidence: { verification: 'verified', sourceId: 'business-core' },
    },
    {
      kind: 'park',
      sourceCore: 'map',
      entityId: 'place-park-1',
      placeId: 'place-park-1',
      displayLabel: 'Parque cercano',
      distanceMeters: 650,
      walkingMinutes: 9,
      evidence: { verification: 'corroborated', sourceId: 'map-core' },
    },
  ],
  generatedAt: '2026-09-18T12:00:00Z',
};

assert(context.building?.building.id === 'building-1', 'Building context must reference one canonical Building id.');
assert(
  context.nearby.every((item) => item.entityId && item.sourceCore),
  'Nearby context must reference source-core entities instead of copying complete entities into Real Estate.',
);
assert(nearbyByKind(context, 'transit').length === 1, 'Context helper must select transit references.');
assert(nearbyByKind(context, 'health').length === 0, 'Context helper must return an empty set when a category is absent.');
assert(
  realEstateContextIsFresh(context, '2026-09-18T12:30:00Z', 60 * 60 * 1000),
  'Recent property context should remain fresh inside its cache window.',
);
assert(
  !realEstateContextIsFresh(context, '2026-09-18T14:00:00Z', 60 * 60 * 1000),
  'Old property context must become stale instead of silently presenting outdated nearby facts.',
);

console.log('PASS: real-estate building and shared-core nearby context contracts');
