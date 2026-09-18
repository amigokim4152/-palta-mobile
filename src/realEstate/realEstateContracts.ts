export type PropertyTransactionType = 'sale' | 'rent' | 'temporary_rent';

export type PropertyType =
  | 'apartment'
  | 'house'
  | 'room'
  | 'office'
  | 'commercial'
  | 'land'
  | 'parcel'
  | 'warehouse';

export type ListingPublisherType = 'owner_direct' | 'broker' | 'real_estate_business';

export type PropertyId = string;
export type ListingId = string;
export type BuildingId = string;
export type BusinessId = string;
export type PlaceId = string;

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface PropertyAddressRef {
  countryCode: 'CL';
  regionCode?: string;
  comunaCode?: string;
  neighborhoodId?: string;
  placeId?: PlaceId;
  displayAddress?: string;
  point?: GeoPoint;
}

/**
 * Stable physical property identity. A property may have multiple listings
 * over time without duplicating the property itself.
 */
export interface Property {
  id: PropertyId;
  type: PropertyType;
  buildingId?: BuildingId;
  address: PropertyAddressRef;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpaces?: number;
  usableAreaM2?: number;
  totalAreaM2?: number;
}

/**
 * Commercial publication for a property. Listing state/pricing belongs here,
 * not on Business and not on the stable Property identity.
 */
export interface PropertyListing {
  id: ListingId;
  propertyId: PropertyId;
  transactionType: PropertyTransactionType;
  publisherType: ListingPublisherType;
  publisherBusinessId?: BusinessId;
  publisherUserId?: string;
  priceClp?: number;
  priceUf?: number;
  commonExpensesClp?: number;
  publishedAt: string;
  expiresAt?: string;
  status: 'draft' | 'active' | 'paused' | 'closed';
}

/**
 * Apartment/condominium/building identity. This lets Palta attach shared
 * neighborhood, access and amenity context without copying it into listings.
 */
export interface Building {
  id: BuildingId;
  name?: string;
  placeId?: PlaceId;
  address: PropertyAddressRef;
}

export interface RealEstateBusinessLink {
  businessId: BusinessId;
  role: 'broker' | 'real_estate_agency';
  activeListingCount?: number;
}

export interface PropertyNeighborhoodContext {
  neighborhoodId?: string;
  nearbyPlaceIds: PlaceId[];
  transitPlaceIds: PlaceId[];
  schoolPlaceIds: PlaceId[];
  healthPlaceIds: PlaceId[];
  parkPlaceIds: PlaceId[];
  groceryPlaceIds: PlaceId[];
}
