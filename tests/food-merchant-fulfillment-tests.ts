import { createFoodFulfillmentFromMerchantDeclaration } from '../src/business/foodMerchantFulfillment.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const merchant = createFoodFulfillmentFromMerchantDeclaration({
  businessId: 'biz-food-1',
  outletId: 'outlet-food-1',
  pickup: true,
  merchantDelivery: true,
  externalDelivery: false,
  deliveryRadiusM: 4500,
  deliveryZoneLabels: ['Providencia', 'Ñuñoa', 'Providencia'],
  minimumOrderClp: 12000,
  deliveryFeeClp: 1500,
  freeDeliveryThresholdClp: 30000,
  prepMinutesMin: 15,
  prepMinutesMax: 25,
  deliveryMinutesMin: 20,
  deliveryMinutesMax: 35,
  channel: 'whatsapp_authorization',
  authorizationReference: 'wa:merchant-thread-123:msg-456',
  declaredAt: '2026-09-18T18:30:00-03:00',
});

assert(merchant.profile.source === 'merchant', 'Merchant declaration must become merchant-sourced fulfillment truth.');
assert(merchant.profile.modes.includes('pickup'), 'Merchant pickup declaration should be preserved.');
assert(merchant.profile.modes.includes('merchant_delivery'), 'Merchant own delivery declaration should be preserved.');
assert(merchant.profile.delivery_fee?.amount_minor === 1500, 'Merchant-declared delivery fee should be stored as CLP fact.');
assert(merchant.profile.delivery_fee?.basis === 'merchant_declared', 'Merchant price must retain merchant-declared provenance.');
assert(merchant.profile.delivery_zone_labels?.length === 2, 'Delivery zones should be normalized and deduplicated.');
assert(merchant.authorizationReference.includes('msg-456'), 'Authorization proof reference must be retained.');

const pickupOnly = createFoodFulfillmentFromMerchantDeclaration({
  businessId: 'biz-food-2',
  pickup: true,
  merchantDelivery: false,
  externalDelivery: false,
  channel: 'owner_portal',
  authorizationReference: 'owner-form:fulfillment-7',
  declaredAt: '2026-09-18T18:40:00-03:00',
});
assert(pickupOnly.profile.modes.length === 1 && pickupOnly.profile.modes[0] === 'pickup', 'Pickup-only merchant should not fabricate delivery.');

let deliveryTermsWithoutDeliveryRejected = false;
try {
  createFoodFulfillmentFromMerchantDeclaration({
    businessId: 'biz-food-3',
    pickup: true,
    merchantDelivery: false,
    externalDelivery: false,
    deliveryFeeClp: 2000,
    channel: 'staff_verified',
    authorizationReference: 'staff:1',
    declaredAt: '2026-09-18T18:40:00-03:00',
  });
} catch {
  deliveryTermsWithoutDeliveryRejected = true;
}
assert(deliveryTermsWithoutDeliveryRejected, 'Delivery terms must not exist without a delivery mode.');

let missingAuthorizationRejected = false;
try {
  createFoodFulfillmentFromMerchantDeclaration({
    businessId: 'biz-food-4',
    pickup: true,
    merchantDelivery: false,
    externalDelivery: false,
    channel: 'whatsapp_authorization',
    authorizationReference: ' ',
    declaredAt: '2026-09-18T18:40:00-03:00',
  });
} catch {
  missingAuthorizationRejected = true;
}
assert(missingAuthorizationRejected, 'Merchant declaration must keep an authorization reference.');

console.log('PASS: food merchant fulfillment declaration tests');
