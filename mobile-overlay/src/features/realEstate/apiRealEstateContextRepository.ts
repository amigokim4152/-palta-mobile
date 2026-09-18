import {
  RealEstateApiError,
  type RealEstatePropertyContextApiResponse,
} from '../../../../src/api/realEstateApiClient';
import type {
  RealEstateContextEvidence,
  RealEstateContextRepository,
  RealEstatePropertyContext,
} from '../../../../src/realEstate/realEstateContext';
import type { MobilePaltaClient } from '../../services/paltaClient';

function projectEvidence(
  evidence: RealEstatePropertyContextApiResponse['nearby'][number]['evidence'],
): RealEstateContextEvidence {
  return {
    verification: evidence.verification,
    ...(evidence.source_id ? { sourceId: evidence.source_id } : {}),
    ...(evidence.observed_at ? { observedAt: evidence.observed_at } : {}),
  };
}

function projectContext(response: RealEstatePropertyContextApiResponse): RealEstatePropertyContext {
  return {
    propertyId: response.property_id,
    ...(response.building
      ? {
          building: {
            building: {
              id: response.building.building_id,
              ...(response.building.name ? { name: response.building.name } : {}),
              ...(response.building.place_id ? { placeId: response.building.place_id } : {}),
              address: {
                countryCode: 'CL',
                ...(response.building.place_id ? { placeId: response.building.place_id } : {}),
                ...(response.building.display_address
                  ? { displayAddress: response.building.display_address }
                  : {}),
              },
            },
            ...(response.building.year_built !== undefined
              ? { yearBuilt: response.building.year_built }
              : {}),
            ...(response.building.floors !== undefined ? { floors: response.building.floors } : {}),
            ...(response.building.unit_count !== undefined
              ? { unitCount: response.building.unit_count }
              : {}),
            evidence: projectEvidence(response.building.evidence),
          },
        }
      : {}),
    nearby: response.nearby.map((item) => ({
      kind: item.kind,
      sourceCore: item.source_core,
      entityId: item.entity_id,
      ...(item.place_id ? { placeId: item.place_id } : {}),
      ...(item.display_label ? { displayLabel: item.display_label } : {}),
      ...(item.distance_meters !== undefined ? { distanceMeters: item.distance_meters } : {}),
      ...(item.walking_minutes !== undefined ? { walkingMinutes: item.walking_minutes } : {}),
      evidence: projectEvidence(item.evidence),
    })),
    generatedAt: response.generated_at,
  };
}

export class ApiRealEstateContextRepository implements RealEstateContextRepository {
  constructor(private readonly client: MobilePaltaClient) {}

  async getByPropertyId(propertyId: string): Promise<RealEstatePropertyContext | null> {
    try {
      return projectContext(await this.client.realEstate.getPropertyContext(propertyId));
    } catch (error) {
      if (error instanceof RealEstateApiError && error.status === 404) return null;
      throw error;
    }
  }
}
