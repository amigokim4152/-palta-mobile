import { InMemoryMessageStore } from '../src/messaging/store.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let messageCounter = 0;
let outboxCounter = 0;
const store = new InMemoryMessageStore({
  nextMessageId: () => `message-${++messageCounter}`,
  nextOutboxEventId: () => `outbox-${++outboxCounter}`,
});

const first = await store.persistMessage({
  conversationId: 'conv-1',
  clientMessageId: 'client-1',
  sender: { actorId: 'user-1', actorType: 'user' },
  type: 'text',
  body: '¿Pueden revisar el parachoques?',
  createdAt: '2026-09-17T19:10:00.000Z',
});
assert(first.message.sequence === 1, 'First persisted message must receive sequence 1.');
assert(first.replayed === false, 'First persistence must not be marked as replay.');

const retry = await store.persistMessage({
  conversationId: 'conv-1',
  clientMessageId: 'client-1',
  sender: { actorId: 'user-1', actorType: 'user' },
  type: 'text',
  body: '¿Pueden revisar el parachoques?',
  createdAt: '2026-09-17T19:10:00.000Z',
});
assert(retry.replayed === true, 'Retry with same sender/clientMessageId must be recognized as replay.');
assert(retry.message.messageId === first.message.messageId, 'Retry must return the original canonical message.');
assert(retry.message.sequence === 1, 'Retry must not consume another conversation sequence.');
assert(retry.outboxEvent.outboxEventId === first.outboxEvent.outboxEventId, 'Retry must not create a second outbox event.');

const second = await store.persistMessage({
  conversationId: 'conv-1',
  clientMessageId: 'business-reply-1',
  sender: { actorId: 'business-1', actorType: 'business', principalUserId: 'staff-user-7' },
  type: 'action_card',
  body: 'Necesitamos revisar el vehículo antes de cotizar.',
  actionRef: {
    resourceType: 'service_request',
    resourceId: 'service-request-1',
    action: 'request_inspection',
    contractVersion: 'v1',
  },
  createdAt: '2026-09-17T19:11:00.000Z',
});
assert(second.message.sequence === 2, 'New message must receive the next sequence.');

const afterOne = await store.listAfter('conv-1', 1, 50);
assert(afterOne.length === 1 && afterOne[0]?.messageId === second.message.messageId, 'Cursor sync must return only messages after the known sequence.');

const all = await store.listAfter('conv-1', 0, 50);
assert(all.length === 2, 'Conversation sync from cursor zero must return all canonical messages once.');

console.log('Message persistence v1 tests passed.');
