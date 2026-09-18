import {
  projectFoodFulfillment,
  type FoodFulfillmentMode,
  type FoodFulfillmentProfile,
} from './foodFulfillment.js';

export type FoodFulfillmentFilter = 'any' | 'delivery' | 'pickup';

export type FoodFulfillmentDiscovery = Readonly<{
  profile?: FoodFulfillmentProfile;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  distanceEligibility: 'eligible' | 'outside_radius' | 'unknown';
  labels: readonly string[];
}>;

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CL')
    .trim();
}

/**
 * Only strong factual labels may infer a fulfillment mode. Generic WhatsApp,
 * "delivery" marketing copy, or being a food business is not enough.
 */
export function inferFoodFulfillmentFromServiceLabels(
  serviceLabels: readonly string[] | undefined,
): FoodFulfillmentProfile | undefined {
  const modes = new Set<FoodFulfillmentMode>();
  for (const rawLabel of serviceLabels ?? []) {
    const label = normalize(rawLabel);
    if (/\b(retiro|pickup|pick up)\b/.test(label)) modes.add('pickup');
    if (/\b(delivery propio|despacho propio|reparto propio|entrega propia)\b/.test(label)) {
      modes.add('merchant_delivery');
    }
    if (/\b(delivery externo|reparto externo)\b/.test(label)) modes.add('external_delivery');
    if (/\b(palta delivery)\b/.test(label)) modes.add('palta_delivery');
  }
  if (modes.size === 0) return undefined;
  return { modes: [...modes], source: 'unknown' };
}

export function projectFoodFulfillmentDiscovery(input: {
  profile?: FoodFulfillmentProfile;
  serviceLabels?: readonly string[];
  distanceM?: number;
}): FoodFulfillmentDiscovery {
  const profile = input.profile ?? inferFoodFulfillmentFromServiceLabels(input.serviceLabels);
  if (!profile) {
    return {
      pickupAvailable: false,
      deliveryAvailable: false,
      distanceEligibility: 'unknown',
      labels: [],
    };
  }

  const projection = projectFoodFulfillment(profile, input.distanceM);
  const labels: string[] = [];
  if (projection.delivery_available) {
    if (projection.delivery_modes.includes('merchant_delivery')) labels.push('Entrega del local');
    else if (projection.delivery_modes.includes('palta_delivery')) labels.push('Palta Delivery');
    else labels.push('Delivery');
  }
  if (projection.pickup_available) labels.push('Retiro');

  return {
    profile,
    pickupAvailable: projection.pickup_available,
    deliveryAvailable: projection.delivery_available,
    distanceEligibility: projection.distance_eligibility,
    labels,
  };
}

export function matchesFoodFulfillmentFilter(
  filter: FoodFulfillmentFilter,
  input: Parameters<typeof projectFoodFulfillmentDiscovery>[0],
): boolean {
  if (filter === 'any') return true;
  const projection = projectFoodFulfillmentDiscovery(input);
  return filter === 'delivery'
    ? projection.deliveryAvailable
    : projection.pickupAvailable;
}
