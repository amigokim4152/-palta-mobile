import type { CommerceOrder, CommerceOrderStatus } from '../src/commerce/commerceModel.js';
import { commerceOrderToFunctionalHome } from '../src/home/adapters/commerceOrderFunctionalAdapter.js';
import { validateHomeFunctionalItem } from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function order(status: CommerceOrderStatus, overrides: Partial<CommerceOrder> = {}): CommerceOrder {
  return {
    id: `order-${status}`,
    businessId: 'biz-1',
    outletId: 'outlet-1',
    tradingSessionId: 'session-1',
    customerId: 'customer-1',
    status,
    totalAmountMinor: 129900,
    currency: 'CLP',
    createdAt: '2026-09-18T08:00:00.000Z',
    updatedAt: '2026-09-18T08:10:00.000Z',
    ...overrides,
  };
}

function project(status: CommerceOrderStatus, overrides: Partial<Parameters<typeof commerceOrderToFunctionalHome>[0]> = {}) {
  return commerceOrderToFunctionalHome({
    order: order(status),
    viewerCustomerId: 'customer-1',
    dataMode: 'live',
    observedAt: '2026-09-18T08:10:00.000Z',
    businessLabel: 'Café Palta',
    ...overrides,
  });
}

assert(
  commerceOrderToFunctionalHome({
    order: order('preparing', { customerId: 'customer-2' }),
    viewerCustomerId: 'customer-1',
    dataMode: 'live',
    observedAt: '2026-09-18T08:10:00.000Z',
  }) === null,
  'Personal Home must not expose another customer order.',
);
assert(
  commerceOrderToFunctionalHome({
    order: order('preparing', { customerId: undefined }),
    viewerCustomerId: 'customer-1',
    dataMode: 'live',
    observedAt: '2026-09-18T08:10:00.000Z',
  }) === null,
  'Anonymous orders must not be exposed through Personal Home.',
);

const payWithTarget = project('awaiting_payment', { actionTarget: '/market/order-awaiting_payment' });
assert(payWithTarget?.surface === 'now' && payWithTarget.kind === 'action', 'Awaiting payment with a real target belongs in AHORA as action.');
assert(payWithTarget?.action?.target === '/market/order-awaiting_payment', 'Payment action must keep the exact order target.');

const payNoTarget = project('awaiting_payment');
assert(payNoTarget?.surface === 'now' && payNoTarget.kind === 'alert', 'Awaiting payment without a target must be an alert, not a fake action.');

const preparing = project('preparing');
assert(preparing?.surface === 'in_progress' && preparing.kind === 'status', 'Preparing order belongs in EN CURSO.');

const readyWithTarget = project('ready', {
  order: order('ready', { pickupCode: 'P-204' }),
  actionTarget: '/market/order-ready',
});
assert(readyWithTarget?.surface === 'now' && readyWithTarget.kind === 'action', 'Ready order with target belongs in AHORA.');
assert(readyWithTarget?.body?.includes('P-204'), 'Pickup code may appear in the customer-owned ready state.');

const readyNoTarget = project('ready');
assert(readyNoTarget?.surface === 'now' && readyNoTarget.kind === 'alert', 'Ready order without target is an alert, not a fake button.');

const refund = project('refund_pending');
assert(refund?.surface === 'in_progress' && refund.kind === 'status', 'Refund pending belongs in EN CURSO.');

for (const state of ['picked_up', 'closed', 'cancelled', 'refunded'] as const) {
  assert(project(state) === null, `${state} order must leave active Home.`);
}
assert(project('created') === null, 'Created order should not clutter Home before a meaningful state.');

for (const item of [payWithTarget, payNoTarget, preparing, readyWithTarget, readyNoTarget, refund]) {
  assert(item && validateHomeFunctionalItem(item).length === 0, 'Projected Commerce order must satisfy Home functional contract.');
}

console.log('PASS: CommerceOrder -> Home functional projection tests');
