import type {
  ListingPublisherType,
  Property,
  PropertyListing,
  PropertyTransactionType,
  PropertyType,
} from './realEstateContracts.js';

export type RealEstateListingSearchItem = {
  listing: PropertyListing;
  property: Property;
  comuna: string;
  sector: string;
  publisherLabel: string;
  publisherType: ListingPublisherType;
  photoUrl?: string;
  featured?: boolean;
};

export type RealEstateListingQuery = {
  text?: string;
  businessId?: string;
  transactionType?: PropertyTransactionType;
  propertyType?: PropertyType;
  publisherType?: ListingPublisherType;
  minPriceClp?: number;
  maxPriceClp?: number;
  minPriceUf?: number;
  maxPriceUf?: number;
  minUsableAreaM2?: number;
  maxUsableAreaM2?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  minParkingSpaces?: number;
};

export interface RealEstateListingRepository {
  search(query: RealEstateListingQuery): Promise<readonly RealEstateListingSearchItem[]>;
  getById(listingId: string): Promise<RealEstateListingSearchItem | null>;
}

function normalized(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase('es-CL') ?? '';
}

function within(value: number | undefined, min?: number, max?: number): boolean {
  if (min !== undefined && (value === undefined || value < min)) return false;
  if (max !== undefined && (value === undefined || value > max)) return false;
  return true;
}

export function matchesRealEstateListingQuery(
  item: RealEstateListingSearchItem,
  query: RealEstateListingQuery,
): boolean {
  if (query.businessId && item.listing.publisherBusinessId !== query.businessId) return false;
  if (query.transactionType && item.listing.transactionType !== query.transactionType) return false;
  if (query.propertyType && item.property.type !== query.propertyType) return false;
  if (query.publisherType && item.publisherType !== query.publisherType) return false;

  if (!within(item.listing.priceClp, query.minPriceClp, query.maxPriceClp)) return false;
  if (!within(item.listing.priceUf, query.minPriceUf, query.maxPriceUf)) return false;
  if (!within(item.property.usableAreaM2, query.minUsableAreaM2, query.maxUsableAreaM2)) return false;
  if (!within(item.property.bedrooms, query.minBedrooms)) return false;
  if (!within(item.property.bathrooms, query.minBathrooms)) return false;
  if (!within(item.property.parkingSpaces, query.minParkingSpaces)) return false;

  const text = normalized(query.text);
  if (!text) return true;

  const haystack = normalized([
    item.comuna,
    item.sector,
    item.property.address.displayAddress,
    item.publisherLabel,
  ].filter(Boolean).join(' '));

  return haystack.includes(text);
}

export function filterRealEstateListings(
  items: readonly RealEstateListingSearchItem[],
  query: RealEstateListingQuery,
): readonly RealEstateListingSearchItem[] {
  return items.filter((item) => matchesRealEstateListingQuery(item, query));
}
