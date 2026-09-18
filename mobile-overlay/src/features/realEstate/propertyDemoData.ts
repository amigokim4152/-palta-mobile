import type {
  ListingPublisherType,
  Property,
  PropertyListing,
} from '../../../../src/realEstate/realEstateContracts';

export type PropertyListingPreview = {
  listing: PropertyListing;
  property: Property;
  comuna: string;
  sector: string;
  publisherLabel: string;
  publisherType: ListingPublisherType;
  photoUrl?: string;
  featured?: boolean;
};

/**
 * Local UI fixtures only. These are intentionally isolated from API/runtime data
 * so the Propiedades screen can be developed without presenting demo inventory
 * as production listings.
 */
export const PROPERTY_DEMO_LISTINGS: readonly PropertyListingPreview[] = [
  {
    listing: {
      id: 'demo-vitacura-001',
      propertyId: 'property-demo-vitacura-001',
      transactionType: 'rent',
      publisherType: 'real_estate_business',
      publisherBusinessId: 'business-demo-corredora-001',
      priceClp: 1450000,
      commonExpensesClp: 235000,
      publishedAt: '2026-09-18T09:00:00-03:00',
      status: 'active',
    },
    property: {
      id: 'property-demo-vitacura-001',
      type: 'apartment',
      address: {
        countryCode: 'CL',
        displayAddress: 'Vitacura, Región Metropolitana',
        point: { latitude: -33.3897, longitude: -70.5708 },
      },
      bedrooms: 3,
      bathrooms: 2,
      parkingSpaces: 2,
      usableAreaM2: 112,
      totalAreaM2: 126,
    },
    comuna: 'Vitacura',
    sector: 'Parque Bicentenario',
    publisherLabel: 'Inmobiliaria · perfil de prueba',
    publisherType: 'real_estate_business',
    featured: true,
  },
  {
    listing: {
      id: 'demo-providencia-001',
      propertyId: 'property-demo-providencia-001',
      transactionType: 'rent',
      publisherType: 'owner_direct',
      publisherUserId: 'demo-owner-001',
      priceClp: 780000,
      commonExpensesClp: 98000,
      publishedAt: '2026-09-17T16:30:00-03:00',
      status: 'active',
    },
    property: {
      id: 'property-demo-providencia-001',
      type: 'apartment',
      address: {
        countryCode: 'CL',
        displayAddress: 'Providencia, Región Metropolitana',
        point: { latitude: -33.4311, longitude: -70.6104 },
      },
      bedrooms: 2,
      bathrooms: 2,
      parkingSpaces: 1,
      usableAreaM2: 68,
      totalAreaM2: 74,
    },
    comuna: 'Providencia',
    sector: 'Pedro de Valdivia',
    publisherLabel: 'Dueño directo · perfil de prueba',
    publisherType: 'owner_direct',
  },
  {
    listing: {
      id: 'demo-nunoa-001',
      propertyId: 'property-demo-nunoa-001',
      transactionType: 'sale',
      publisherType: 'broker',
      publisherBusinessId: 'business-demo-broker-001',
      priceUf: 7450,
      publishedAt: '2026-09-16T12:10:00-03:00',
      status: 'active',
    },
    property: {
      id: 'property-demo-nunoa-001',
      type: 'apartment',
      address: {
        countryCode: 'CL',
        displayAddress: 'Ñuñoa, Región Metropolitana',
        point: { latitude: -33.4569, longitude: -70.5979 },
      },
      bedrooms: 3,
      bathrooms: 2,
      parkingSpaces: 1,
      usableAreaM2: 88,
      totalAreaM2: 96,
    },
    comuna: 'Ñuñoa',
    sector: 'Plaza Ñuñoa',
    publisherLabel: 'Corredor · perfil de prueba',
    publisherType: 'broker',
  },
  {
    listing: {
      id: 'demo-las-condes-001',
      propertyId: 'property-demo-las-condes-001',
      transactionType: 'sale',
      publisherType: 'real_estate_business',
      publisherBusinessId: 'business-demo-inmobiliaria-002',
      priceUf: 12800,
      publishedAt: '2026-09-15T10:20:00-03:00',
      status: 'active',
    },
    property: {
      id: 'property-demo-las-condes-001',
      type: 'house',
      address: {
        countryCode: 'CL',
        displayAddress: 'Las Condes, Región Metropolitana',
        point: { latitude: -33.4018, longitude: -70.5552 },
      },
      bedrooms: 4,
      bathrooms: 3,
      parkingSpaces: 2,
      usableAreaM2: 190,
      totalAreaM2: 310,
    },
    comuna: 'Las Condes',
    sector: 'Los Dominicos',
    publisherLabel: 'Inmobiliaria · perfil de prueba',
    publisherType: 'real_estate_business',
  },
] as const;

export function findDemoPropertyListing(listingId: string) {
  return PROPERTY_DEMO_LISTINGS.find((item) => item.listing.id === listingId);
}
