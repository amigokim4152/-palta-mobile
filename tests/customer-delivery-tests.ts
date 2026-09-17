import {
  applyCustomerDeliveryResult,
  createCustomerArtifact,
  createCustomerDelivery,
  createRelationshipTouchpoint,
  isAuthoritativeDeliveryStatus,
  type CustomerContactPermission,
} from '../src/commerce/customerDelivery.js';
import {
  buildCustomerShareMessage,
  canUseCustomerShareLink,
  createCustomerShareLink,
  recordCustomerShareLinkUse,
  revokeCustomerShareLink,
} from '../src/commerce/customerShareLink.js';
import { buildWhatsAppHandoffPlan } from '../src/adapters/customerDelivery/whatsappHandoff.js';

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

const artifact = createCustomerArtifact({
  id: 'artifact-1',
  businessId: 'biz-1',
  kind: 'fiscal_document',
  sourceId: 'fiscal-1',
  title: 'Boleta electrónica',
  secureLinkRef: 'share-1',
  expiresAt: '2026-09-18T12:00:00Z',
});

const transactionalOnly: CustomerContactPermission = {
  customerId: 'customer-1',
  transactionalAllowed: true,
  serviceFollowUpAllowed: false,
  marketingAllowed: false,
  allowedChannels: new Set(['whatsapp_handoff', 'palta_inbox']),
};

let delivery = createCustomerDelivery({
  id: 'delivery-1',
  businessId: 'biz-1',
  artifact,
  purpose: 'transactional',
  channel: 'whatsapp_handoff',
  destination: { customerId: 'customer-1', phoneE164: '+56912345678' },
  customerId: 'customer-1',
  permission: transactionalOnly,
  idempotencyKey: 'send-fiscal-1-wa',
  createdAt: '2026-09-17T12:00:00Z',
});
assertEqual(delivery.status, 'prepared', 'Transactional delivery must begin prepared.');

assertThrows(() => createCustomerDelivery({
  id: 'delivery-marketing',
  businessId: 'biz-1',
  artifact,
  purpose: 'marketing',
  channel: 'whatsapp_handoff',
  destination: { phoneE164: '+56912345678' },
  customerId: 'customer-1',
  permission: transactionalOnly,
  idempotencyKey: 'marketing-1',
  createdAt: '2026-09-17T12:00:00Z',
}), 'Transactional receipt permission must not authorize marketing.');

const shareLink = createCustomerShareLink({
  id: 'share-1',
  businessId: 'biz-1',
  artifactId: artifact.id,
  tokenHash: 'a'.repeat(64),
  scope: 'view_fiscal_document',
  createdAt: '2026-09-17T12:00:00Z',
  expiresAt: '2026-09-18T12:00:00Z',
  maxUses: 3,
});
assert(canUseCustomerShareLink(shareLink, '2026-09-17T13:00:00Z'), 'Fresh share link must be usable.');
const used = recordCustomerShareLinkUse(shareLink, '2026-09-17T13:00:00Z');
assertEqual(used.useCount, 1, 'Share-link use count must advance.');
assert(!canUseCustomerShareLink(used, '2026-09-19T00:00:00Z'), 'Expired share link must be rejected.');
assert(!canUseCustomerShareLink(revokeCustomerShareLink(used, '2026-09-17T14:00:00Z'), '2026-09-17T14:01:00Z'), 'Revoked share link must be rejected.');

const message = buildCustomerShareMessage({
  title: 'Tu boleta',
  body: 'Puedes ver tu boleta aquí:',
  publicShareUrl: 'https://somospalta.cl/s/a-safe-token',
});
const handoff = buildWhatsAppHandoffPlan({
  deliveryId: delivery.id,
  businessId: 'biz-1',
  channel: 'whatsapp_handoff',
  destination: { phoneE164: '+56912345678' },
  title: message.title,
  message: message.body,
  secureLink: message.url,
});
assert(handoff.url.startsWith('https://wa.me/56912345678?text='), 'WhatsApp handoff must use normalized international number.');
assert(handoff.url.includes('somospalta.cl'), 'WhatsApp handoff must carry the Palta share link.');
assertThrows(() => buildWhatsAppHandoffPlan({
  deliveryId: 'bad', businessId: 'biz-1', channel: 'whatsapp_handoff', destination: { phoneE164: '912345678' }, title: 'Bad', message: 'Bad',
}), 'WhatsApp handoff must reject non-E.164 phone numbers.');

delivery = applyCustomerDeliveryResult(delivery, { outcome: 'handed_off' }, '2026-09-17T12:01:00Z');
assertEqual(delivery.status, 'handed_off', 'User-controlled WhatsApp opening must record handed_off only.');
assert(isAuthoritativeDeliveryStatus('whatsapp_handoff', delivery.status), 'Handed-off is the honest terminal status for user-controlled WhatsApp route.');
assert(!isAuthoritativeDeliveryStatus('whatsapp_business', 'sent'), 'Provider sent does not equal delivered when delivery receipts exist.');

const touchpoint = createRelationshipTouchpoint({
  id: 'touch-1',
  delivery,
  artifact,
  occurredAt: '2026-09-17T12:01:00Z',
});
assertEqual(touchpoint.type, 'transactional_delivery', 'Receipt/Boleta share must enter CRM as transactional history.');
assertEqual(touchpoint.grantsFuturePermission, false, 'CRM touchpoint must never grant future marketing permission.');

const guestDelivery = createCustomerDelivery({
  id: 'guest-delivery',
  businessId: 'biz-1',
  artifact,
  purpose: 'transactional',
  channel: 'system_share',
  destination: {},
  idempotencyKey: 'guest-share-1',
  createdAt: '2026-09-17T12:00:00Z',
});
assertEqual(guestDelivery.status, 'prepared', 'Guest one-off transactional share must work without forcing CRM enrollment.');

console.log('customer-delivery-tests: ok');
