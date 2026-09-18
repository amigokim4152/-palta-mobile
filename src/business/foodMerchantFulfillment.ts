import {
  validateFoodFulfillmentProfile,
  type FoodFulfillmentMode,
  type FoodFulfillmentProfile,
  type FoodMoneyEvidence,
} from './foodFulfillment.js';

export type FoodMerchantDeclarationChannel =
  | 'owner_portal'
  | 'whatsapp_authorization'
  | 'staff_verified';

export type FoodMerchantFulfillmentDeclaration = Readonly<{
  businessId: string;
  outletId?: string;
  pickup: boolean;
  merchantDelivery: boolean;
  externalDelivery: boolean;
  paltaDeliveryEligible?: boolean;
  deliveryRadiusM?: number;
  deliveryZoneLabels?: readonly string[];
  minimumOrderClp?: number;
  deliveryFeeClp?: number;
  freeDeliveryThresholdClp?: number;
  prepMinutesMin?: number;
  prepMinutesMax?: number;
  deliveryMinutesMin?: number;
  deliveryMinutesMax?: number;
  channel: FoodMerchantDeclarationChannel;
  authorizationReference: string;
  declaredAt: string;
}>;

export type FoodMerchantFulfillmentRecord = Readonly<{
  businessId: string;
  outletId?: string;
  profile: FoodFulfillmentProfile;
  declarationChannel: FoodMerchantDeclarationChannel;
  authorizationReference: string;
  declaredAt: string;
}>;

export function createFoodFulfillmentFromMerchantDeclaration(
  declaration: FoodMerchantFulfillmentDeclaration,
): FoodMerchantFulfillmentRecord {
  const businessId = declaration.businessId.trim();
  const authorizationReference = declaration.authorizationReference.trim();
  if (!businessId) throw new Error('business_id_required');
  if (!authorizationReference) throw new Error('merchant_authorization_reference_required');
  if (!Number.isFinite(Date.parse(declaration.declaredAt))) {
    throw new Error('merchant_declaration_time_invalid');
  }

  const modes: FoodFulfillmentMode[] = [];
  if (declaration.pickup) modes.push('pickup');
  if (declaration.merchantDelivery) modes.push('merchant_delivery');
  if (declaration.externalDelivery) modes.push('external_delivery');
  if (declaration.paltaDeliveryEligible) modes.push('palta_delivery');
  if (modes.length === 0) throw new Error('merchant_fulfillment_mode_required');

  const profile: FoodFulfillmentProfile = {
    modes,
    source: 'merchant',
    updated_at: declaration.declaredAt,
    ...(declaration.deliveryRadiusM !== undefined
      ? { delivery_radius_m: declaration.deliveryRadiusM }
      : {}),
    ...(declaration.deliveryZoneLabels?.length
      ? { delivery_zone_labels: [...new Set(declaration.deliveryZoneLabels.map((value) => value.trim()).filter(Boolean))] }
      : {}),
    ...moneyField('minimum_order', declaration.minimumOrderClp, declaration.declaredAt),
    ...moneyField('delivery_fee', declaration.deliveryFeeClp, declaration.declaredAt),
    ...moneyField('free_delivery_threshold', declaration.freeDeliveryThresholdClp, declaration.declaredAt),
    ...minuteField('prep_minutes', declaration.prepMinutesMin, declaration.prepMinutesMax),
    ...minuteField('delivery_minutes', declaration.deliveryMinutesMin, declaration.deliveryMinutesMax),
  };

  const hasDelivery = modes.some((mode) => mode !== 'pickup');
  if (!hasDelivery) {
    if (
      declaration.deliveryRadiusM !== undefined ||
      declaration.deliveryZoneLabels?.length ||
      declaration.deliveryFeeClp !== undefined ||
      declaration.freeDeliveryThresholdClp !== undefined ||
      declaration.deliveryMinutesMin !== undefined ||
      declaration.deliveryMinutesMax !== undefined
    ) {
      throw new Error('delivery_terms_require_delivery_mode');
    }
  }

  validateFoodFulfillmentProfile(profile);

  return {
    businessId,
    ...(declaration.outletId?.trim() ? { outletId: declaration.outletId.trim() } : {}),
    profile,
    declarationChannel: declaration.channel,
    authorizationReference,
    declaredAt: declaration.declaredAt,
  };
}

function moneyField<K extends 'minimum_order' | 'delivery_fee' | 'free_delivery_threshold'>(
  key: K,
  amountClp: number | undefined,
  observedAt: string,
): Partial<Record<K, FoodMoneyEvidence>> {
  if (amountClp === undefined) return {};
  if (!Number.isInteger(amountClp) || amountClp < 0) throw new Error(`${key}_clp_invalid`);
  return {
    [key]: {
      amount_minor: amountClp,
      currency: 'CLP',
      basis: 'merchant_declared',
      observed_at: observedAt,
    },
  } as Partial<Record<K, FoodMoneyEvidence>>;
}

function minuteField<K extends 'prep_minutes' | 'delivery_minutes'>(
  key: K,
  min: number | undefined,
  max: number | undefined,
): Partial<Record<K, { min: number; max?: number }>> {
  if (min === undefined && max === undefined) return {};
  if (min === undefined) throw new Error(`${key}_min_required`);
  return {
    [key]: {
      min,
      ...(max !== undefined ? { max } : {}),
    },
  } as Partial<Record<K, { min: number; max?: number }>>;
}
