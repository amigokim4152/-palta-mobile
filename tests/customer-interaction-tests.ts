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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}
function assertThrows(fn: () => unknown, message: string): void {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(message);
}

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

assertCustomerInteractionEnabled(config, 'split_payment');
assertThrows(() => assertCustomerInteractionEnabled(config, 'receipt_share'), 'Disabled customer interaction capability must be blocked.');

const entry = createCustomerEntryContext({
  id: 'entry-1',
  businessId: 'biz-1',
  outletId: 'outlet-1',
  tableId: 'table-8',
  opaqueEntryToken: 'opaque-token-1234567890',
});
assertEqual(entry.status, 'active', 'QR entry context must begin active.');
assertThrows(() => createCustomerEntryContext({
  id: 'entry-2', businessId: 'biz-1', outletId: 'outlet-1', opaqueEntryToken: 'short',
}), 'Short predictable QR tokens must be rejected.');

const first = reservePaymentShare({
  id: 'share-1',
  order,
  existingShares: [],
  participantId: 'p1',
  method: 'by_item',
  itemIds: ['i1'],
});
assertEqual(first.amountMinor, 10000, 'Item split must derive exact item amount.');
assertEqual(unpaidAmountMinor(order, [first]), 5000, 'Remaining order balance must account for reserved shares.');

assertThrows(() => reservePaymentShare({
  id: 'share-dup', order, existingShares: [first], participantId: 'p2', method: 'by_item', itemIds: ['i1'],
}), 'Two participants must not reserve the same item.');

const second = reservePaymentShare({
  id: 'share-2',
  order,
  existingShares: [first],
  participantId: 'p2',
  method: 'custom_amount',
  amountMinor: 5000,
});
assertEqual(unpaidAmountMinor(order, [first, second]), 0, 'Payment shares may exactly cover the order.');
assertThrows(() => reservePaymentShare({
  id: 'share-over', order, existingShares: [first], participantId: 'p2', method: 'custom_amount', amountMinor: 6000,
}), 'Payment shares must not exceed the remaining balance.');

const withIntent = attachPaymentIntentToShare(first, 'pi-1');
const paid = markPaymentSharePaid(withIntent);
assertEqual(paid.status, 'paid', 'Payment share must become paid only after a payment intent is attached.');
assertThrows(() => releasePaymentShare(paid), 'Paid shares must never be released automatically.');

const releasable: PaymentShare = {
  id: 'share-3', sharedOrderId: order.id, participantId: 'p2', method: 'custom_amount', amountMinor: 5000, itemIds: [], status: 'reserved',
};
assertEqual(releasePaymentShare(releasable).status, 'released', 'Unpaid reserved share may be released.');

assertEqual(decideFiscalGrouping({ isSingleSharedSale: true, customersAreMakingIndependentPurchases: false }), 'single_sale_document', 'Shared payment alone must not split the fiscal sale.');
assertEqual(decideFiscalGrouping({ isSingleSharedSale: false, customersAreMakingIndependentPurchases: true }), 'separate_commerce_transactions', 'Independent purchases must use separate commerce transactions.');

assert(order.participants.length === 2, 'Shared order test fixture must retain both participants.');
console.log('customer-interaction-tests: ok');
