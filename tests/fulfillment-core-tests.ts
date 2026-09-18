import type { CommerceOrder } from '../src/commerce/commerceModel.js';
import {
  createFulfillmentPlan,
  fulfillmentCanCloseOrder,
  transitionFulfillment,
  validateFulfillmentQuote,
  type FulfillmentQuote,
} from '../src/commerce/fulfillment.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const order: CommerceOrder = {
  id: 'order-food-1',
  businessId: 'biz-food-1',
  outletId: 'outlet-food-1',
  tradingSessionId: 'session-food-1',
  customerId: 'customer-1',
  status: 'accepted',
  totalAmountMinor: 18990,
  currency: 'CLP',
  createdAt: '2026-09-18T18:00:00-03:00',
  updatedAt: '2026-09-18T18:02:00-03:00',
};

const merchantQuote: FulfillmentQuote = {
  id: 'fq-1',
  businessId: order.businessId,
  outletId: order.outletId,
  method: 'merchant_delivery',
  serviceable: true,
  currency: 'CLP',
  feeAmountMinor: 1500,
  source: 'merchant_rule',
  estimatedMinutesMin: 25,
  estimatedMinutesMax: 40,
  expiresAt: '2026-09-18T18:20:00-03:00',
};
validateFulfillmentQuote(merchantQuote, '2026-09-18T18:05:00-03:00');

let delivery = createFulfillmentPlan({
  id: 'fulfillment-1',
  order,
  method: 'merchant_delivery',
  quote: merchantQuote,
  destination: {
    lat: -33.43,
    lng: -70.61,
    addressLabel: 'Providencia, Santiago',
    instructions: 'Conserjería',
  },
  createdAt: '2026-09-18T18:05:00-03:00',
});
assert(delivery.status === 'planned', 'Delivery starts as a planned fulfillment, not a fabricated in-transit state.');
assert(delivery.feeAmountMinor === 1500, 'Accepted fulfillment quote must preserve the actual delivery fee.');

delivery = transitionFulfillment(delivery, 'assign', {
  updatedAt: '2026-09-18T18:12:00-03:00',
  courierReference: 'merchant-driver-7',
});
assert(delivery.status === 'assigned', 'Merchant delivery should record courier assignment.');

delivery = transitionFulfillment(delivery, 'mark_ready', {
  updatedAt: '2026-09-18T18:20:00-03:00',
});
assert(delivery.status === 'ready_for_handoff', 'Prepared order should become ready for courier handoff.');

delivery = transitionFulfillment(delivery, 'start_transit', {
  updatedAt: '2026-09-18T18:23:00-03:00',
});
assert(delivery.status === 'in_transit', 'Delivery must enter transit explicitly.');

delivery = transitionFulfillment(delivery, 'complete', {
  updatedAt: '2026-09-18T18:45:00-03:00',
});
assert(fulfillmentCanCloseOrder(delivery), 'Completed fulfillment may allow the order to close.');

let pickup = createFulfillmentPlan({
  id: 'fulfillment-pickup-1',
  order,
  method: 'pickup',
  createdAt: '2026-09-18T18:05:00-03:00',
});
pickup = transitionFulfillment(pickup, 'mark_ready', {
  updatedAt: '2026-09-18T18:20:00-03:00',
});
pickup = transitionFulfillment(pickup, 'complete', {
  updatedAt: '2026-09-18T18:30:00-03:00',
});
assert(pickup.status === 'completed', 'Pickup should complete without courier assignment.');

let missingDestinationRejected = false;
try {
  createFulfillmentPlan({
    id: 'fulfillment-invalid-1',
    order,
    method: 'external_delivery',
    createdAt: '2026-09-18T18:05:00-03:00',
  });
} catch {
  missingDestinationRejected = true;
}
assert(missingDestinationRejected, 'Delivery fulfillment must require a destination.');

let pickupCourierRejected = false;
try {
  transitionFulfillment(
    createFulfillmentPlan({
      id: 'fulfillment-invalid-2',
      order,
      method: 'pickup',
      createdAt: '2026-09-18T18:05:00-03:00',
    }),
    'assign',
    {
      updatedAt: '2026-09-18T18:06:00-03:00',
      courierReference: 'driver-1',
    },
  );
} catch {
  pickupCourierRejected = true;
}
assert(pickupCourierRejected, 'Pickup must never fabricate a courier assignment.');

console.log('PASS: commerce fulfillment core tests');
