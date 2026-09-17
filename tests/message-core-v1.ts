import { buildDomainActionRequest } from '../src/messaging/actionBridge.js';
import { addContextRef, primaryContext } from '../src/messaging/context.js';
import { advanceDelivered, advanceRead, messageIdempotencyKey, unreadCount } from '../src/messaging/readState.js';
import type { ConversationContextRef, ParticipantState } from '../src/messaging/contracts.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const joinedAt = '2026-09-17T18:00:00.000Z';
const customer: ParticipantState = {
  conversationId: 'conv-vehicle-repair-1',
  actor: { actorId: 'user-1', actorType: 'user' },
  role: 'customer',
  joinedAt,
  lastDeliveredSequence: 7,
  lastReadSequence: 5,
  muted: false,
  archived: false,
};

assert(unreadCount(9, customer) === 4, 'Unread count must derive from conversation sequence, not per-message read rows.');
const delivered = advanceDelivered(customer, 9);
assert(delivered.lastDeliveredSequence === 9, 'Delivered sequence must advance monotonically.');
const read = advanceRead(delivered, 8);
assert(read.lastReadSequence === 8 && read.lastDeliveredSequence === 9, 'Read must advance without moving delivery backwards.');
const staleRead = advanceRead(read, 6);
assert(staleRead.lastReadSequence === 8, 'Late/out-of-order read receipts must not move read state backwards.');

const key1 = messageIdempotencyKey('conv-1', 'business-1', 'client-123');
const key2 = messageIdempotencyKey('conv-1', 'business-1', 'client-123');
assert(key1 === key2, 'Retrying the same client message must produce the same idempotency key.');

let contexts: ConversationContextRef[] = [];
contexts = addContextRef(contexts, {
  conversationId: 'conv-vehicle-repair-1',
  relation: 'primary',
  resourceType: 'service_request',
  resourceId: 'service-request-1',
});
contexts = addContextRef(contexts, {
  conversationId: 'conv-vehicle-repair-1',
  relation: 'vehicle',
  resourceType: 'vehicle',
  resourceId: 'vehicle-honda-1',
});
contexts = addContextRef(contexts, {
  conversationId: 'conv-vehicle-repair-1',
  relation: 'business',
  resourceType: 'business',
  resourceId: 'taller-abc',
});
contexts = addContextRef(contexts, {
  conversationId: 'conv-vehicle-repair-1',
  relation: 'vehicle',
  resourceType: 'vehicle',
  resourceId: 'vehicle-honda-1',
});
assert(contexts.length === 3, 'Conversation context references must dedupe without copying domain objects.');
assert(primaryContext(contexts)?.resourceId === 'service-request-1', 'Primary conversation context must remain stable.');

const action = buildDomainActionRequest({
  requestId: 'action-request-1',
  conversationId: 'conv-vehicle-repair-1',
  sourceMessageId: 'message-quote-card-1',
  requestedBy: { actorId: 'user-1', actorType: 'user' },
  actionRef: {
    resourceType: 'reservation',
    resourceId: 'reservation-1',
    action: 'confirm',
    contractVersion: 'v1',
  },
  requestedAt: joinedAt,
});
assert(action.target.resourceType === 'reservation', 'Message action must target the owning domain by reference.');
assert(action.target.resourceId === 'reservation-1', 'Message Core must preserve the canonical domain object ID.');
assert(!('reservationPayload' in action), 'Message Core must not duplicate reservation domain state.');

console.log('Message Core v1 contract tests passed.');
