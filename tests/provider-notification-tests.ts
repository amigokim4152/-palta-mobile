import {
  createProviderNotificationInboxItem,
  markProviderNotificationProcessed,
  markProviderNotificationProcessing,
  markProviderNotificationRetryable,
  PROVIDER_NOTIFICATION_IS_SIGNAL_NOT_TRUTH,
} from '../src/payment/providerNotification.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const receivedAt = '2026-09-17T12:00:00.000Z';

const verified = createProviderNotificationInboxItem({
  id: 'notif-1',
  providerKey: 'mercadopago_point',
  providerEventId: 'event-123',
  providerResourceReference: 'ORD-123',
  payloadHash: 'sha256:abc123',
  signatureVerified: true,
  receivedAt,
  providerEventType: 'order.processed',
  requestId: 'request-123',
});
assert(
  verified.status === 'verified' && verified.attempts === 0,
  'Verified provider callback must enter durable inbox before asynchronous processing.',
);

const processing = markProviderNotificationProcessing(
  verified,
  '2026-09-17T12:00:01.000Z',
);
assert(
  processing.status === 'processing' && processing.attempts === 1,
  'Verified inbox item must count processing attempts.',
);

const retryable = markProviderNotificationRetryable(
  processing,
  '2026-09-17T12:00:02.000Z',
  '2026-09-17T12:00:10.000Z',
  'provider_status_lookup_failed',
);
assert(
  retryable.status === 'retryable_error' &&
    retryable.nextAttemptAt === '2026-09-17T12:00:10.000Z',
  'Provider status lookup failure must preserve the inbox event for retry.',
);

const processingAgain = markProviderNotificationProcessing(
  retryable,
  '2026-09-17T12:00:10.000Z',
);
const processed = markProviderNotificationProcessed(
  processingAgain,
  '2026-09-17T12:00:11.000Z',
);
assert(
  processed.status === 'processed' &&
    processed.attempts === 2 &&
    processed.processedAt === '2026-09-17T12:00:11.000Z',
  'Retryable provider notification must eventually process without losing attempt history.',
);

const rejected = createProviderNotificationInboxItem({
  id: 'notif-bad',
  providerKey: 'mercadopago_point',
  providerEventId: 'event-bad',
  providerResourceReference: 'ORD-BAD',
  payloadHash: 'sha256:bad',
  signatureVerified: false,
  receivedAt,
});
assert(rejected.status === 'rejected', 'Invalid signature must be rejected immediately.');

let rejectedBlocked = false;
try {
  markProviderNotificationProcessing(rejected, '2026-09-17T12:00:01.000Z');
} catch {
  rejectedBlocked = true;
}
assert(
  rejectedBlocked,
  'Unverified callback must never enter payment-state processing.',
);

assert(
  PROVIDER_NOTIFICATION_IS_SIGNAL_NOT_TRUTH === true,
  'Webhook payload must remain a wake-up signal; authoritative provider state is fetched separately.',
);

console.log('PASS: payment provider notification inbox tests');
