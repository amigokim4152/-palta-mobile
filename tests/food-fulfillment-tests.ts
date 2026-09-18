import {
  projectFoodFulfillment,
  validateFoodFulfillmentProfile,
  type FoodFulfillmentProfile,
} from '../src/business/foodFulfillment.js';
import {
  createFoodOrderIntentForMode,
} from '../src/business/foodVertical.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const merchantDelivery: FoodFulfillmentProfile = {
  modes: ['pickup', 'merchant_delivery'],
  delivery_radius_m: 4500,
  minimum_order: {
    amount_minor: 12000,
    currency: 'CLP',
    basis: 'merchant_declared',
  },
  delivery_fee: {
    amount_minor: 1500,
    currency: 'CLP',
    basis: 'merchant_declared',
  },
  prep_minutes: { min: 15, max: 25 },
  delivery_minutes: { min: 20, max: 35 },
  source: 'merchant',
};

validateFoodFulfillmentProfile(merchantDelivery);

const nearby = projectFoodFulfillment(merchantDelivery, 2300);
assert(nearby.pickup_available, 'Pickup should stay available when declared by the merchant.');
assert(nearby.delivery_available, 'Merchant delivery should be available inside the declared radius.');
assert(nearby.distance_eligibility === 'eligible', 'Distance inside the delivery radius should be eligible.');
assert(nearby.delivery_modes[0] === 'merchant_delivery', 'Merchant delivery mode should be preserved.');

const farAway = projectFoodFulfillment(merchantDelivery, 6000);
assert(!farAway.delivery_available, 'Delivery should not be advertised outside a declared radius.');
assert(farAway.distance_eligibility === 'outside_radius', 'Outside-radius state must stay explicit.');
assert(farAway.pickup_available, 'Outside delivery radius must not disable pickup.');

const unknownDistance = projectFoodFulfillment(merchantDelivery);
assert(unknownDistance.delivery_available, 'Unknown distance must not fabricate an outside-radius result.');
assert(unknownDistance.distance_eligibility === 'unknown', 'Unknown customer distance should remain unknown.');

const deliveryIntent = createFoodOrderIntentForMode('biz-food-1', 'merchant_delivery');
assert(deliveryIntent.preferredFulfillment === 'delivery', 'Merchant delivery must hand off as Commerce delivery.');
assert(deliveryIntent.preferredDeliveryMode === 'merchant_delivery', 'Specific delivery mode must survive the handoff.');

const pickupIntent = createFoodOrderIntentForMode('biz-food-1', 'pickup');
assert(pickupIntent.preferredFulfillment === 'pickup', 'Pickup must hand off as Commerce pickup.');
assert(pickupIntent.preferredDeliveryMode === undefined, 'Pickup must not fabricate a delivery provider.');

const observedPromoFee: FoodFulfillmentProfile = {
  modes: ['external_delivery'],
  delivery_fee: {
    amount_minor: 990,
    reference_amount_minor: 1990,
    currency: 'CLP',
    basis: 'official_source_observed',
    promotion: true,
    observed_at: '2026-09-18T17:00:00-03:00',
  },
  source: 'verified_public_source',
};
validateFoodFulfillmentProfile(observedPromoFee);
assert(observedPromoFee.delivery_fee?.promotion === true, 'Observed promotional delivery fee must remain marked as promotional.');
assert(observedPromoFee.delivery_fee?.basis === 'official_source_observed', 'Observed price must not be relabeled as merchant-declared regular price.');

let invalidRadiusRejected = false;
try {
  validateFoodFulfillmentProfile({
    modes: ['merchant_delivery'],
    delivery_radius_m: 0,
    source: 'merchant',
  });
} catch {
  invalidRadiusRejected = true;
}
assert(invalidRadiusRejected, 'Zero or negative delivery radius must be rejected.');

console.log('PASS: food fulfillment contract tests');
