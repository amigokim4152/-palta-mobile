import {
  inferFoodFulfillmentFromServiceLabels,
  matchesFoodFulfillmentFilter,
  projectFoodFulfillmentDiscovery,
} from '../src/business/foodFulfillmentDiscovery.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const inferred = inferFoodFulfillmentFromServiceLabels([
  'Sushi',
  'Retiro en local',
  'Delivery propio',
]);
assert(inferred?.modes.includes('pickup'), 'Strong retiro label should infer pickup.');
assert(inferred?.modes.includes('merchant_delivery'), 'Strong own-delivery label should infer merchant delivery.');

const vague = inferFoodFulfillmentFromServiceLabels(['Sushi', 'WhatsApp', 'Comida a domicilio']);
assert(vague === undefined, 'Vague food/contact labels must not fabricate fulfillment capability.');

const inside = projectFoodFulfillmentDiscovery({
  profile: {
    modes: ['pickup', 'merchant_delivery'],
    delivery_radius_m: 3000,
    source: 'merchant',
  },
  distanceM: 2500,
});
assert(inside.deliveryAvailable, 'Restaurant should be deliverable inside its declared radius.');
assert(inside.pickupAvailable, 'Pickup should stay independently available.');
assert(inside.labels.includes('Entrega del local'), 'Own delivery should have a consumer-facing label.');

const outside = projectFoodFulfillmentDiscovery({
  profile: {
    modes: ['pickup', 'merchant_delivery'],
    delivery_radius_m: 3000,
    source: 'merchant',
  },
  distanceM: 4000,
});
assert(!outside.deliveryAvailable, 'Restaurant should not be advertised as deliverable outside its radius.');
assert(outside.pickupAvailable, 'Pickup should remain available outside delivery radius.');
assert(!matchesFoodFulfillmentFilter('delivery', {
  profile: {
    modes: ['pickup', 'merchant_delivery'],
    delivery_radius_m: 3000,
    source: 'merchant',
  },
  distanceM: 4000,
}), 'Delivery filter must exclude outside-radius restaurants.');
assert(matchesFoodFulfillmentFilter('pickup', {
  profile: { modes: ['pickup'], source: 'merchant' },
}), 'Pickup filter should include confirmed pickup businesses.');
assert(matchesFoodFulfillmentFilter('any', {}), 'Any filter must preserve businesses whose fulfillment is not known yet.');
assert(!matchesFoodFulfillmentFilter('delivery', {}), 'Delivery filter must not include unknown capability as if confirmed.');

console.log('PASS: food fulfillment discovery tests');
