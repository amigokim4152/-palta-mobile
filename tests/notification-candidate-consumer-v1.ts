import type { EventBusPort, PaltaEvent, PaltaEventType } from '../src/events/eventBusPort.js';
import {
  startNotificationCandidateConsumer,
  type NotificationDeliveryQueuePort,
} from '../src/notifications/notificationCandidateConsumer.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class InMemoryEventBus implements EventBusPort {
  private subscriptions: Array<{
    types: readonly PaltaEventType[];
    handler: (event: PaltaEvent) => Promise<void> | void;
    active: boolean;
  }> = [];

  async publish(event: PaltaEvent): Promise<void> {
    for (const subscription of this.subscriptions) {
      if (subscription.active && subscription.types.includes(event.type)) {
        await subscription.handler(event);
      }
    }
  }

  async subscribe(
    types: readonly PaltaEventType[],
    handler: (event: PaltaEvent) => Promise<void> | void,
  ): Promise<() => void> {
    const subscription = { types, handler, active: true };
    this.subscriptions.push(subscription);
    return () => {
      subscription.active = false;
    };
  }
}

const queued: Parameters<NotificationDeliveryQueuePort['enqueueIfAbsent']>[0][] = [];
const eventBus = new InMemoryEventBus();
const consumer = await startNotificationCandidateConsumer({
  eventBus,
  audience: {
    async resolveRecipients(input) {
      assert(input.conversationId === 'conv-1', 'Audience lookup must receive conversation reference only.');
      assert(input.messageId === 'message-1', 'Audience lookup must receive canonical message reference.');
      return [
        { recipientUserId: 'user-recipient' },
        { recipientUserId: 'user-recipient' },
        { recipientUserId: 'user-muted' },
        { recipientUserId: 'user-quiet' },
      ];
    },
  },
  preferences: {
    async decide(input) {
      if (input.recipientUserId === 'user-muted') return { decision: 'suppress' };
      if (input.recipientUserId === 'user-quiet') {
        return {
          decision: 'defer',
          notBefore: '2026-09-18T08:00:00-03:00',
        };
      }
      return { decision: 'send_now' };
    },
  },
  presentation: {
    async present(input) {
      if (input.recipientUserId === 'user-recipient') {
        return { title: 'Taller ABC에서 새 메시지가 왔습니다' };
      }
      return {};
    },
  },
  queue: {
    async enqueueIfAbsent(input) {
      queued.push(input);
      return { enqueued: true };
    },
  },
});

await eventBus.publish({
  id: 'candidate-1',
  type: 'notification.candidate',
  source: 'message-core',
  occurredAt: '2026-09-17T23:30:00.000Z',
  dedupeKey: 'message-notification:message-1',
  payload: {
    sourceEventId: 'outbox-message-1',
    sourceType: 'message.created',
    conversationId: 'conv-1',
    messageId: 'message-1',
    sequence: 12,
  },
});

assert(Number(queued.length) === 2, 'Muted user must be suppressed and duplicate recipient must be deduped.');
const immediate = queued.find((item) => item.recipientUserId === 'user-recipient');
const deferred = queued.find((item) => item.recipientUserId === 'user-quiet');
assert(immediate?.dedupeKey === 'message-notification:message-1:user-recipient', 'Delivery queue dedupe must be per message + recipient.');
assert(immediate?.envelope.category === 'message', 'Message candidate must produce message notification category.');
assert(immediate?.envelope.target === 'palta://context/conv-1', 'Message notification must deep-link into the conversation context.');
assert(immediate?.envelope.collapseKey === 'message:conv-1', 'Conversation notifications must share a collapse key.');
assert(immediate?.envelope.body === undefined, 'Message body preview must remain absent unless presentation policy explicitly supplies it.');
assert(deferred?.notBefore === '2026-09-18T08:00:00-03:00', 'Quiet-hours policy must be able to defer delivery without dropping it.');

const serialized = JSON.stringify(queued).toLowerCase();
for (const forbidden of ['phone', 'email', 'address', 'paymentpayload', 'sharetoken']) {
  assert(!serialized.includes(forbidden), `Notification delivery command must not copy ${forbidden}.`);
}

await consumer.close();
await eventBus.publish({
  id: 'after-close',
  type: 'notification.candidate',
  source: 'message-core',
  occurredAt: '2026-09-17T23:31:00.000Z',
  payload: {
    sourceType: 'message.created',
    conversationId: 'conv-1',
    messageId: 'message-1',
  },
});
assert(Number(queued.length) === 2, 'Closed notification consumer must stop delivery queue work.');

console.log('Notification candidate consumer tests passed.');
