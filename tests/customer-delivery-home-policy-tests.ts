import {
  applyCustomerDeliveryResult,
  createCustomerArtifact,
  createCustomerDelivery,
} from '../src/commerce/customerDelivery.js';
import { decideCustomerDeliveryPresentation } from '../src/home/customerDeliveryPresentationPolicy.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const artifact = createCustomerArtifact({
  id: 'artifact-1',
  businessId: 'business-1',
  kind: 'order_status',
  sourceId: 'order-1',
  title: 'Estado de tu pedido',
});

const prepared = createCustomerDelivery({
  id: 'delivery-1',
  businessId: 'business-1',
  artifact,
  purpose: 'transactional',
  channel: 'palta_inbox',
  destination: { paltaUserId: 'user-1' },
  idempotencyKey: 'delivery-1-v1',
  createdAt: '2026-09-18T12:00:00.000Z',
  customerId: 'customer-1',
});

const preparedDecision = decideCustomerDeliveryPresentation({
  delivery: prepared,
  artifact,
});
assert(
  preparedDecision.createHomeLifecycleItem === false &&
    preparedDecision.createPaltaInboxNotification === false,
  'Prepared transport state must not appear as a Home lifecycle card.',
);

const delivered = applyCustomerDeliveryResult(
  prepared,
  { outcome: 'delivered', providerReference: 'inbox-1' },
  '2026-09-18T12:01:00.000Z',
);
const deliveredDecision = decideCustomerDeliveryPresentation({
  delivery: delivered,
  artifact,
});
assert(!deliveredDecision.createHomeLifecycleItem, 'Delivered message transport must still not become Home lifecycle state.');
assert(deliveredDecision.createPaltaInboxNotification, 'Authoritative Palta Inbox delivery may create an Inbox notification.');

const whatsappPrepared = createCustomerDelivery({
  id: 'delivery-wa',
  businessId: 'business-1',
  artifact,
  purpose: 'transactional',
  channel: 'whatsapp_handoff',
  destination: { phoneE164: '+56911111111' },
  idempotencyKey: 'delivery-wa-v1',
  createdAt: '2026-09-18T12:00:00.000Z',
});
const whatsappHandoff = applyCustomerDeliveryResult(
  whatsappPrepared,
  { outcome: 'handed_off' },
  '2026-09-18T12:01:00.000Z',
);
const whatsappDecision = decideCustomerDeliveryPresentation({
  delivery: whatsappHandoff,
  artifact,
});
assert(
  !whatsappDecision.createHomeLifecycleItem && !whatsappDecision.createPaltaInboxNotification,
  'External channel handoff must not fabricate Palta Home or Inbox state.',
);

const failed = applyCustomerDeliveryResult(
  prepared,
  { outcome: 'failed', code: 'provider_down', retryable: true },
  '2026-09-18T12:02:00.000Z',
);
const failedDecision = decideCustomerDeliveryPresentation({ delivery: failed, artifact });
assert(failedDecision.operatorAttentionRequired, 'Delivery transport failure should remain an operator/retry concern.');
assert(!failedDecision.createHomeLifecycleItem, 'Transport failure must not masquerade as customer lifecycle state.');

let mismatchRejected = false;
try {
  decideCustomerDeliveryPresentation({
    delivery: delivered,
    artifact: { ...artifact, id: 'artifact-other' },
  });
} catch {
  mismatchRejected = true;
}
assert(mismatchRejected, 'Mismatched delivery/artifact state must be rejected.');

console.log('PASS: CustomerDelivery presentation boundary tests');
