import assert from 'node:assert/strict';
import {
  assertCustomerInteractionEnabled,
  attachPaymentIntentToShare,
  createCustomerEntryContext,
  decideFiscalGrouping,
  markPaymentSharePaid,
  reservePaymentShare,
  releasePaymentShare,
  unpaidAmountMinor,
  type CustomerInteractionConfig,
  type PaymentShare,
  type SharedOrder,
} from '../src/commerce/customerInteraction.js';

const order: SharedOrder = {
  id: 'order-1',
  businessId: 'biz-1',
  outletId: 'outlet-1',
  entryContextId: 'entry-1',
  currency: 'CLP',
  status: 'payment_open',
  revision: 0,
  participants: [
    { id: 'p1', displayName: 'A', joinedAt: '2026-09-17T10:00:00Z', status: 'active' },
    { id: 'p2', displayName: 'B', joinedAt: '2026-09-17T10:00:01Z', status: 'active' },
  ],
  items: [
    { id: 'i1', productOrServiceId: 'burger', label: 'Burger', quantity: 1, unitAmountMinor: 10000, totalAmountMinor: 10000, addedByParticipantId: 'p1' },
    { id: 'i2', productOrServiceId: 'drink', label: 'Drink', quantity: 1, unitAmountMinor: 5000, totalAmountMinor: 5000, addedByParticipantId: 'p2' },
  ],
};

const config: CustomerInteractionConfig = {
  businessId: 'biz-1',
  outletId: 'outlet-1',
  capabilities: new Set(['qr_menu', 'self_order', 'self_pay', 'group_order', 'split_payment']),
  guestAccessAllowed: true,
  requireStaffAcceptance: true,
};

assert.doesNotThrow(() => assertCustomerInteractionEnabled(config, 'split_payment'));
assert.throws(() => assertCustomerInteractionEnabled(config, 'receipt_share'));

const entry = createCustomerEntryContext({
  id: 'entry-1',
  businessId: 'biz-1',
  outletId: 'outlet-1',
  tableId: 'table-8',
  opaqueEntryToken: 'opaque-token-1234567890',
});
assert.equal(entry.status, 'active');
assert.throws(() => createCustomerEntryContext({
  id: 'entry-2', businessId: 'biz-1', outletId: 'outlet-1', opaqueEntryToken: 'short',
}));

const first = reservePaymentShare({
  id: 'share-1',
  order,
  existingShares: [],
  participantId: 'p1',
  method: 'by_item',
  itemIds: ['i1'],
});
assert.equal(first.amountMinor, 10000);
assert.equal(unpaidAmountMinor(order, [first]), 5000);

assert.throws(() => reservePaymentShare({
  id: 'share-dup', order, existingShares: [first], participantId: 'p2', method: 'by_item', itemIds: ['i1'],
}));

const second = reservePaymentShare({
  id: 'share-2',
  order,
  existingShares: [first],
  participantId: 'p2',
  method: 'custom_amount',
  amountMinor: 5000,
});
assert.equal(unpaidAmountMinor(order, [first, second]), 0);
assert.throws(() => reservePaymentShare({
  id: 'share-over', order, existingShares: [first], participantId: 'p2', method: 'custom_amount', amountMinor: 6000,
}));

const withIntent = attachPaymentIntentToShare(first, 'pi-1');
const paid = markPaymentSharePaid(withIntent);
assert.equal(paid.status, 'paid');
assert.throws(() => releasePaymentShare(paid));

const releasable: PaymentShare = {
  id: 'share-3', sharedOrderId: order.id, participantId: 'p2', method: 'custom_amount', amountMinor: 5000, itemIds: [], status: 'reserved',
};
assert.equal(releasePaymentShare(releasable).status, 'released');

assert.equal(decideFiscalGrouping({ isSingleSharedSale: true, customersAreMakingIndependentPurchases: false }), 'single_sale_document');
assert.equal(decideFiscalGrouping({ isSingleSharedSale: false, customersAreMakingIndependentPurchases: true }), 'separate_commerce_transactions');

console.log('customer-interaction-tests: ok');
