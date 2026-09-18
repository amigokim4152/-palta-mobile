import type { LocalSearchItem } from '../../../../../src/api/paltaApiClient';
import type { FoodFulfillmentProfile } from '../../../../../src/business/foodFulfillment';
import {
  matchesFoodFulfillmentFilter,
  projectFoodFulfillmentDiscovery,
  type FoodFulfillmentFilter,
} from '../../../../../src/business/foodFulfillmentDiscovery';
import { isFoodVerticalBusiness } from '../../../../../src/business/foodVertical';
import { projectLocalBusinesses } from '../../../../../src/business/localBusinessDiscovery';
import { readLocalBusinessDiscoveryPreview } from '../../../../../src/business/localBusinessDiscoveryPreview';

export type FoodSearchItem = LocalSearchItem & {
  food_fulfillment?: FoodFulfillmentProfile;
};

export type FoodDiscoveryItem = FoodSearchItem & {
  preview: ReturnType<typeof readLocalBusinessDiscoveryPreview>;
};

export function foodFulfillmentInput(item: FoodDiscoveryItem) {
  return {
    ...(item.food_fulfillment ? { profile: item.food_fulfillment } : {}),
    serviceLabels: item.preview.serviceLabels,
    ...(item.distance_m !== undefined ? { distanceM: item.distance_m } : {}),
  };
}

export function projectFoodSearchResults(
  items: readonly LocalSearchItem[],
  options: {
    openNowOnly: boolean;
    fulfillmentFilter: FoodFulfillmentFilter;
  },
): FoodDiscoveryItem[] {
  const projected = projectLocalBusinesses(
    items.map((rawItem) => {
      const item = rawItem as FoodSearchItem;
      return {
        entityId: item.entity_id,
        entityType: item.entity_type,
        name: item.name,
        ...(item.category_key ? { categoryKey: item.category_key } : {}),
        ...(item.distance_m !== undefined ? { distanceM: item.distance_m } : {}),
        ...(item.verification_status ? { verificationStatus: item.verification_status } : {}),
        ...(item.operational_state ? { operationalState: item.operational_state } : {}),
        ...(item.operational_confirmed_at
          ? { operationalConfirmedAt: item.operational_confirmed_at }
          : {}),
        ...(item.location ? { location: item.location } : {}),
        preview: readLocalBusinessDiscoveryPreview(item),
        source: item,
      };
    }),
    { openNowOnly: options.openNowOnly },
  );

  return projected
    .filter((item) =>
      isFoodVerticalBusiness({
        categoryKey: item.categoryKey,
        name: item.name,
        serviceLabels: item.preview?.serviceLabels,
      }),
    )
    .map((item) => {
      const source = item.source as FoodSearchItem;
      return {
        ...source,
        preview: item.preview ?? readLocalBusinessDiscoveryPreview(source),
      } satisfies FoodDiscoveryItem;
    })
    .filter((item) =>
      matchesFoodFulfillmentFilter(options.fulfillmentFilter, foodFulfillmentInput(item)),
    );
}

export function projectFoodItemFulfillment(item: FoodDiscoveryItem) {
  return projectFoodFulfillmentDiscovery(foodFulfillmentInput(item));
}
