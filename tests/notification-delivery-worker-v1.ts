import type { PaltaNotificationEnvelope } from '../src/notifications/notificationEnvelope.js';
import {
  NotificationDeliveryWorker,
  type ClaimedNotificationDelivery,
  type NotificationDeliveryStorePort,
  type NotificationProviderAdapter,
} from '../src/notifications/notificationDeliveryWorker.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const envelope: PaltaNotificationEnvelope = {
  id: 'notification-1',
  category: 'message',
  title: '새 메시지가 있습니다',
  target: 'palta://context/conv-1',
  occurredAt: '2026-09-17T23:30:00.000Z',
};

class FakeStore implements NotificationDeliveryStorePort {
  claimed: ClaimedNotificationDelivery[] = [];
  sent: string[] = [];
  retried: Array<{ id: string; retryAt: string }> = [];
  cancelled: string[] = [];

  async claimBatch() {
    const batch = this.claimed;
    this.claimed = [];
    return batch;
  }

  async markSent(input: { deliveryId: string }) {
    this.sent.push(input.deliveryId);
    return true;
  }

  async markRetry(input: { deliveryId: string; retryAt: string }) {
    this.retried.push({ id: input.deliveryId, retryAt: input.retryAt });
    return true;
  }

  async markCancelled(input: { deliveryId: string }) {
    this.cancelled.push(input.deliveryId);
    return true;
  }
}

const store = new FakeStore();
store.claimed = [
  {
    deliveryId: 'delivery-sent',
    recipientUserId: 'user-sent',
    dedupeKey: 'dedupe-sent',
    envelope,
    attemptCount: 1,
    processingToken: 'token-1',
  },
  {
    deliveryId: 'delivery-retry',
    recipientUserId: 'user-retry',
    dedupeKey: 'dedupe-retry',
    envelope,
    attemptCount: 1,
    processingToken: 'token-1',
  },
  {
    deliveryId: 'delivery-drop',
    recipientUserId: 'user-drop',
    dedupeKey: 'dedupe-drop',
    envelope,
    attemptCount: 1,
    processingToken: 'token-1',
  },
  {
    deliveryId: 'delivery-throw',
    recipientUserId: 'user-throw',
    dedupeKey: 'dedupe-throw',
    envelope,
    attemptCount: 1,
    processingToken: 'token-1',
  },
];

const provider: NotificationProviderAdapter = {
  async send(input) {
    if (input.recipientUserId === 'user-sent') return { disposition: 'sent' };
    if (input.recipientUserId === 'user-retry') {
      return {
        disposition: 'retry',
        retryAt: '2026-09-17T23:35:00.000Z',
        error: 'temporary provider failure',
      };
    }
    if (input.recipientUserId === 'user-drop') {
      return { disposition: 'drop', reason: 'no registered device' };
    }
    throw new Error('provider unavailable');
  },
};

let nowCalls = 0;
const worker = new NotificationDeliveryWorker(store, provider, {
  nextProcessingToken: () => 'token-1',
  now: () => {
    nowCalls += 1;
    return `2026-09-17T23:${String(30 + nowCalls).padStart(2, '0')}:00.000Z`;
  },
  staleBefore: () => '2026-09-17T23:20:00.000Z',
});

const result = await worker.runBatch(10);
assert(result.claimed === 4, 'Worker must report claimed delivery count.');
assert(result.sent === 1, 'Successful provider result must mark one delivery sent.');
assert(result.retried === 2, 'Explicit retry and thrown provider failure must both schedule retries.');
assert(result.dropped === 1, 'Permanent/no-device provider result must cancel one delivery.');
assert(result.lostLease === 0, 'Owned leases must update successfully.');
assert(store.sent[0] === 'delivery-sent', 'Sent delivery identity must be preserved.');
assert(store.retried.some((item) => item.id === 'delivery-retry'), 'Explicit retry must be persisted.');
assert(store.retried.some((item) => item.id === 'delivery-throw'), 'Provider exception must be converted into retry.');
assert(store.cancelled[0] === 'delivery-drop', 'Drop result must not be retried forever.');

console.log('Notification delivery worker tests passed.');
