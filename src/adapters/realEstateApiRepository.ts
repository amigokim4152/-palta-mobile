import type { RealEstateApiClient, RealEstateListingApiItem } from '../api/realEstateApiClient.js';
import type {
  RealEstateListingQuery,
  RealEstateListingRepository,
  RealEstateListingSearchItem,
} from '../realEstate/realEstateRepository.js';

function mapApiListing(item: RealEstateListingApiItem): RealEstateListingSearchItem {
  const point = item.latitude !== undefined && item.longitude !== undefined
    ? { latitude: item.latitude, longitude: item.longitude }
    : undefined;

  return {
    listing: {
      id: item.listing_id,
      propertyId: item.property_id,
      transactionType: item.transaction_type,
      publisherType: item.publisher_type,
      ...(item.publisher_business_id ? { publisherBusinessId: item.publisher_business_id } : {}),
      ...(item.publisher_user_id ? { publisherUserId: item.publisher_user_id } : {}),
      ...(item.price_clp !== undefined ? { priceClp: item.price_clp } : {}),
      ...(item.price_uf !== undefined ? { priceUf: item.price_uf } : {}),
      ...(item.common_expenses_clp !== undefined ? { commonExpensesClp: item.common_expenses_clp } : {}),
      publishedAt: item.published_at,
      ...(item.expires_at ? { expiresAt: item.expires_at } : {}),
      status: item.status,
    },
    property: {
      id: item.property_id,
      type: item.property_type,
      ...(item.building_id ? { buildingId: item.building_id } : {}),
      address: {
        countryCode: 'CL',
        ...(item.display_address ? { displayAddress: item.display_address } : {}),
        ...(point ? { point } : {}),
      },
      ...(item.bedrooms !== undefined ? { bedrooms: item.bedrooms } : {}),
      ...(item.bathrooms !== undefined ? { bathrooms: item.bathrooms } : {}),
      ...(item.parking_spaces !== undefined ? { parkingSpaces: item.parking_spaces } : {}),
      ...(item.usable_area_m2 !== undefined ? { usableAreaM2: item.usable_area_m2 } : {}),
      ...(item.total_area_m2 !== undefined ? { totalAreaM2: item.total_area_m2 } : {}),
    },
    comuna: item.comuna,
    sector: item.sector,
    publisherLabel: item.publisher_label,
    publisherType: item.publisher_type,
    ...(item.photo_url ? { photoUrl: item.photo_url } : {}),
    ...(item.featured !== undefined ? { featured: item.featured } : {}),
  };
}

export function createRealEstateApiRepository(
  client: RealEstateApiClient,
): RealEstateListingRepository {
  return {
    async search(query: RealEstateListingQuery) {
      const response = await client.searchListings(query);
      return response.items.map(mapApiListing);
    },

    async getById(listingId: string) {
      try {
        return mapApiListing(await client.getListing(listingId));
      } catch (error) {
        if (error instanceof Error && error.message.endsWith(': 404')) return null;
        throw error;
      }
    },
  };
}
