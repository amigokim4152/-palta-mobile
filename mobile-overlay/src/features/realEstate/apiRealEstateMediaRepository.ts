import { RealEstateApiError } from '../../../../src/api/realEstateApiClient';
import {
  sortRealEstateMedia,
  type RealEstateListingMedia,
  type RealEstateMediaRepository,
} from '../../../../src/realEstate/realEstateMedia';
import type { MobilePaltaClient } from '../../services/paltaClient';

export class ApiRealEstateMediaRepository implements RealEstateMediaRepository {
  constructor(private readonly client: MobilePaltaClient) {}

  async getForListing(listingId: string): Promise<RealEstateListingMedia | null> {
    try {
      const response = await this.client.realEstate.getListingMedia(listingId);
      return {
        listingId: response.listing_id,
        items: sortRealEstateMedia(response.items.map((item) => ({
          mediaAssetId: item.media_asset_id,
          kind: item.kind,
          role: item.role,
          sortOrder: item.sort_order,
          ...(item.delivery_url ? { deliveryUrl: item.delivery_url } : {}),
          ...(item.width !== undefined ? { width: item.width } : {}),
          ...(item.height !== undefined ? { height: item.height } : {}),
          ...(item.alt_text ? { altText: item.alt_text } : {}),
        }))),
        generatedAt: response.generated_at,
      };
    } catch (error) {
      if (error instanceof RealEstateApiError && error.status === 404) return null;
      throw error;
    }
  }
}
