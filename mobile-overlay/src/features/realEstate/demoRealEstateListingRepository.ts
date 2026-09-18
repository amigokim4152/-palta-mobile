import type {
  RealEstateListingQuery,
  RealEstateListingRepository,
} from '../../../../src/realEstate/realEstateRepository';
import { filterRealEstateListings } from '../../../../src/realEstate/realEstateRepository';
import { PROPERTY_DEMO_LISTINGS } from './propertyDemoData';

export const demoRealEstateListingRepository: RealEstateListingRepository = {
  async search(query: RealEstateListingQuery) {
    return filterRealEstateListings(PROPERTY_DEMO_LISTINGS, query);
  },

  async getById(listingId: string) {
    return PROPERTY_DEMO_LISTINGS.find((item) => item.listing.id === listingId) ?? null;
  },
};
