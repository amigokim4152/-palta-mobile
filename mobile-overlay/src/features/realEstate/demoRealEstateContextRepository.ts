import type {
  RealEstateContextRepository,
  RealEstatePropertyContext,
} from '../../../../src/realEstate/realEstateContext';

const DEMO_CONTEXTS: readonly RealEstatePropertyContext[] = [
  {
    propertyId: 'property-demo-vitacura-001',
    building: {
      building: {
        id: 'building-demo-vitacura-001',
        name: 'Edificio demo Parque Bicentenario',
        placeId: 'place-building-vitacura-001',
        address: {
          countryCode: 'CL',
          placeId: 'place-building-vitacura-001',
          displayAddress: 'Vitacura, Región Metropolitana',
        },
      },
      yearBuilt: 2018,
      floors: 12,
      unitCount: 48,
      evidence: {
        verification: 'demo',
        sourceId: 'real-estate-demo-context',
        observedAt: '2026-09-18T12:00:00-03:00',
      },
    },
    nearby: [
      {
        kind: 'park',
        sourceCore: 'map',
        entityId: 'place-parque-bicentenario-demo',
        placeId: 'place-parque-bicentenario-demo',
        displayLabel: 'Parque cercano',
        distanceMeters: 350,
        walkingMinutes: 5,
        evidence: { verification: 'demo', sourceId: 'map-core-demo' },
      },
      {
        kind: 'business',
        sourceCore: 'business',
        entityId: 'business-supermarket-vitacura-demo',
        displayLabel: 'Comercio cercano',
        distanceMeters: 520,
        walkingMinutes: 7,
        evidence: { verification: 'demo', sourceId: 'business-core-demo' },
      },
      {
        kind: 'school',
        sourceCore: 'education',
        entityId: 'school-vitacura-demo',
        displayLabel: 'Colegio cercano',
        distanceMeters: 900,
        walkingMinutes: 12,
        evidence: { verification: 'demo', sourceId: 'education-core-demo' },
      },
    ],
    generatedAt: '2026-09-18T12:00:00-03:00',
  },
  {
    propertyId: 'property-demo-providencia-001',
    building: {
      building: {
        id: 'building-demo-providencia-001',
        name: 'Edificio demo Pedro de Valdivia',
        placeId: 'place-building-providencia-001',
        address: {
          countryCode: 'CL',
          placeId: 'place-building-providencia-001',
          displayAddress: 'Providencia, Región Metropolitana',
        },
      },
      yearBuilt: 2015,
      floors: 16,
      unitCount: 96,
      evidence: {
        verification: 'demo',
        sourceId: 'real-estate-demo-context',
        observedAt: '2026-09-18T12:00:00-03:00',
      },
    },
    nearby: [
      {
        kind: 'transit',
        sourceCore: 'transport',
        entityId: 'metro-pedro-de-valdivia-demo',
        placeId: 'place-metro-pdv-demo',
        displayLabel: 'Metro Pedro de Valdivia',
        distanceMeters: 420,
        walkingMinutes: 6,
        evidence: { verification: 'demo', sourceId: 'transport-core-demo' },
      },
      {
        kind: 'grocery',
        sourceCore: 'business',
        entityId: 'business-supermarket-providencia-demo',
        displayLabel: 'Supermercado cercano',
        distanceMeters: 300,
        walkingMinutes: 4,
        evidence: { verification: 'demo', sourceId: 'business-core-demo' },
      },
      {
        kind: 'health',
        sourceCore: 'health',
        entityId: 'health-provider-providencia-demo',
        displayLabel: 'Salud cercana',
        distanceMeters: 750,
        walkingMinutes: 10,
        evidence: { verification: 'demo', sourceId: 'health-core-demo' },
      },
      {
        kind: 'park',
        sourceCore: 'map',
        entityId: 'place-park-providencia-demo',
        placeId: 'place-park-providencia-demo',
        displayLabel: 'Parque cercano',
        distanceMeters: 680,
        walkingMinutes: 9,
        evidence: { verification: 'demo', sourceId: 'map-core-demo' },
      },
    ],
    generatedAt: '2026-09-18T12:00:00-03:00',
  },
];

export const demoRealEstateContextRepository: RealEstateContextRepository = {
  async getByPropertyId(propertyId) {
    return DEMO_CONTEXTS.find((context) => context.propertyId === propertyId) ?? null;
  },
};
