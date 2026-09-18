export type FoodFulfillmentMode =
  | 'pickup'
  | 'merchant_delivery'
  | 'external_delivery'
  | 'palta_delivery';

export type FoodFulfillmentEvidenceSource =
  | 'merchant'
  | 'verified_public_source'
  | 'platform_integration'
  | 'unknown';

export type FoodMoneyEvidence = Readonly<{
  amount_minor: number;
  currency: string;
  basis: 'merchant_declared' | 'official_source_observed' | 'platform_quote' | 'unknown';
  reference_amount_minor?: number;
  promotion?: boolean;
  observed_at?: string;
  valid_until?: string;
}>;

export type FoodMinuteRange = Readonly<{
  min: number;
  max?: number;
}>;

/**
 * Local Business owns the restaurant fulfillment capability projection only.
 * Commerce Core continues to own order/payment lifecycle state.
 */
export type FoodFulfillmentProfile = Readonly<{
  modes: readonly FoodFulfillmentMode[];
  delivery_radius_m?: number;
  delivery_zone_labels?: readonly string[];
  minimum_order?: FoodMoneyEvidence;
  delivery_fee?: FoodMoneyEvidence;
  free_delivery_threshold?: FoodMoneyEvidence;
  prep_minutes?: FoodMinuteRange;
  delivery_minutes?: FoodMinuteRange;
  source: FoodFulfillmentEvidenceSource;
  updated_at?: string;
}>;

export type FoodFulfillmentProjection = Readonly<{
  pickup_available: boolean;
  delivery_available: boolean;
  delivery_modes: readonly Exclude<FoodFulfillmentMode, 'pickup'>[];
  distance_eligibility: 'eligible' | 'outside_radius' | 'unknown';
}>;

const DELIVERY_MODES = new Set<FoodFulfillmentMode>([
  'merchant_delivery',
  'external_delivery',
  'palta_delivery',
]);

export function isFoodDeliveryMode(
  mode: FoodFulfillmentMode,
): mode is Exclude<FoodFulfillmentMode, 'pickup'> {
  return DELIVERY_MODES.has(mode);
}

export function hasFoodFulfillmentMode(
  profile: FoodFulfillmentProfile | undefined,
  mode: FoodFulfillmentMode,
): boolean {
  return Boolean(profile?.modes.includes(mode));
}

export function projectFoodFulfillment(
  profile: FoodFulfillmentProfile | undefined,
  distanceM?: number,
): FoodFulfillmentProjection {
  if (!profile) {
    return {
      pickup_available: false,
      delivery_available: false,
      delivery_modes: [],
      distance_eligibility: 'unknown',
    };
  }

  const deliveryModes = profile.modes.filter(isFoodDeliveryMode);
  let distanceEligibility: FoodFulfillmentProjection['distance_eligibility'] = 'unknown';

  if (deliveryModes.length > 0 && distanceM !== undefined && profile.delivery_radius_m !== undefined) {
    distanceEligibility = distanceM <= profile.delivery_radius_m ? 'eligible' : 'outside_radius';
  }

  return {
    pickup_available: profile.modes.includes('pickup'),
    delivery_available: deliveryModes.length > 0 && distanceEligibility !== 'outside_radius',
    delivery_modes: deliveryModes,
    distance_eligibility: distanceEligibility,
  };
}

export function foodFulfillmentNeedsAddressCheck(
  profile: FoodFulfillmentProfile | undefined,
): boolean {
  if (!profile) return false;
  return profile.modes.some(isFoodDeliveryMode) && profile.delivery_radius_m !== undefined;
}

export function validateFoodFulfillmentProfile(profile: FoodFulfillmentProfile): void {
  if (profile.modes.length === 0) throw new Error('food_fulfillment_modes_required');
  if (new Set(profile.modes).size !== profile.modes.length) {
    throw new Error('food_fulfillment_modes_must_be_unique');
  }
  if (profile.delivery_radius_m !== undefined && profile.delivery_radius_m <= 0) {
    throw new Error('food_delivery_radius_must_be_positive');
  }
  validateMinuteRange(profile.prep_minutes, 'food_prep_minutes_invalid');
  validateMinuteRange(profile.delivery_minutes, 'food_delivery_minutes_invalid');
  validateMoney(profile.minimum_order, 'food_minimum_order_invalid');
  validateMoney(profile.delivery_fee, 'food_delivery_fee_invalid');
  validateMoney(profile.free_delivery_threshold, 'food_free_delivery_threshold_invalid');
}

function validateMinuteRange(range: FoodMinuteRange | undefined, code: string): void {
  if (!range) return;
  if (range.min < 0 || (range.max !== undefined && range.max < range.min)) throw new Error(code);
}

function validateMoney(value: FoodMoneyEvidence | undefined, code: string): void {
  if (!value) return;
  if (value.amount_minor < 0 || !value.currency.trim()) throw new Error(code);
  if (
    value.reference_amount_minor !== undefined &&
    value.reference_amount_minor < value.amount_minor &&
    value.promotion === true
  ) {
    throw new Error(code);
  }
}
