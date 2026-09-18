import {
  buildConversationInboxApiResponse,
  conversationToApi,
  inboxActorFromApi,
  inboxCursorFromApi,
} from '../src/messaging/conversationApiContract.js';
import { conversationHttpContract } from '../src/messaging/conversationHttpContract.js';
import type { ConversationInboxItem } from '../src/messaging/conversationDirectoryPort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const userActor = inboxActorFromApi({ principalUserId: 'user-1' });
assert(userActor.actorType === 'user' && userActor.actorId === 'user-1', 'Default Inbox actor must be authenticated user.');
assert(userActor.principalUserId === undefined, 'User actor must not duplicate principal audit field.');

const businessActor = inboxActorFromApi({
  principalUserId: 'staff-real-1',
  actingActor: { actor_type: 'business', actor_id: 'business-1' },
});
assert(businessActor.actorType === 'business' && businessActor.actorId === 'business-1', 'Business Inbox request must preserve visible business actor.');
assert(businessActor.principalUserId === 'staff-real-1', 'Server must inject real employee principal for authorization only.');

const cursor = inboxCursorFromApi({
  lastActivityAt: '2026-09-17T20:30:00.000Z',
  conversationId: '00000000-0000-4000-8000-000000000010',
});
assert(cursor?.conversationId.endsWith('0010'), 'Inbox API cursor must require the activity/id pair.');
let partialCursorRejected = false;
try {
  inboxCursorFromApi({ lastActivityAt: '2026-09-17T20:30:00.000Z' });
} catch {
  partialCursorRejected = true;
}
assert(partialCursorRejected, 'Partial Inbox cursor must be rejected instead of guessing pagination state.');

assert(
  conversationHttpContract.openBusinessConversation('business / 1') ===
    '/v1/messages/businesses/business%20%2F%201/conversation',
  'Business conversation HTTP path must encode canonical business identity.',
);
assert(
  conversationHttpContract.openDirectUserConversation('user / 2') ===
    '/v1/messages/users/user%20%2F%202/conversation',
  'Direct user conversation HTTP path must encode counterpart identity.',
);
let emptyCounterpartRejected = false;
try {
  conversationHttpContract.openDirectUserConversation('   ');
} catch {
  emptyCounterpartRejected = true;
}
assert(emptyCounterpartRejected, 'Direct user conversation route must reject an empty counterpart id.');

const conversation = {
  conversationId: '00000000-0000-4000-8000-000000000001',
  type: 'business' as const,
  lastSequence: 9,
  lastActivityAt: '2026-09-17T20:30:00.000Z',
  createdAt: '2026-09-17T18:00:00.000Z',
};
const openResponse = conversationToApi(conversation, false);
assert(openResponse.conversation_id === conversation.conversationId, 'Open/reuse API must return durable conversation identity.');
assert(openResponse.created === false, 'Open/reuse API must tell client when conversation was reused.');

const directOpenResponse = conversationToApi(
  {
    ...conversation,
    conversationId: '00000000-0000-4000-8000-000000000003',
    type: 'direct',
  },
  true,
);
assert(directOpenResponse.conversation_type === 'direct', 'Direct-user open API must preserve direct relationship type.');
assert(directOpenResponse.created === true, 'Direct-user open API must preserve create/reuse signal.');

const items: ConversationInboxItem[] = [
  {
    conversation,
    counterpartActors: [{ actorType: 'business', actorId: 'business-1' }],
    unreadCount: 2,
    lastMessage: {
      messageId: 'message-9',
      sequence: 9,
      type: 'voice',
      createdAt: '2026-09-17T20:30:00.000Z',
    },
  },
  {
    conversation: {
      ...conversation,
      conversationId: '00000000-0000-4000-8000-000000000002',
      lastActivityAt: '2026-09-17T20:20:00.000Z',
    },
    counterpartActors: [{ actorType: 'business', actorId: 'business-2' }],
    unreadCount: 0,
    lastMessage: {
      messageId: 'message-3',
      sequence: 3,
      type: 'text',
      body: 'Listo para retirar.',
      createdAt: '2026-09-17T20:20:00.000Z',
    },
  },
];
const page = buildConversationInboxApiResponse({ items, requestedLimit: 2 });
assert(page.items.length === 2, 'Inbox API must map all authorized items.');
assert(page.items[0]?.unread_count === 2, 'Inbox API must preserve incoming unread count.');
assert(page.items[0]?.last_message?.message_type === 'voice', 'Voice preview must not require transcript/body.');
assert(page.next_cursor?.conversation_id === items[1]?.conversation.conversationId, 'Full page must expose keyset cursor from last item.');
const serialized = JSON.stringify(page).toLowerCase();
for (const forbidden of ['principaluserid', 'principal_user_id', 'phone', 'email', 'address', 'bearer', 'token']) {
  assert(!serialized.includes(forbidden), `Public Inbox API must not expose ${forbidden}.`);
}

console.log('Message conversation API contract tests passed.');
