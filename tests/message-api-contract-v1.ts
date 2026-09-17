import {
  buildMessageListResponse,
  messageToApi,
  sendCommandFromApi,
} from '../src/messaging/apiContract.js';
import type { Message } from '../src/messaging/contracts.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const businessCommand = sendCommandFromApi({
  principalUserId: 'staff-real-1',
  conversationId: 'conv-1',
  serverNow: '2026-09-17T20:00:00.000Z',
  request: {
    client_message_id: 'offline-mutation-100',
    scope_id: 'scope-order-1',
    acting_actor: {
      actor_type: 'business',
      actor_id: 'business-1',
    },
    message_type: 'text',
    body: 'Tu pedido salió a reparto.',
  },
});
assert(businessCommand.principalUserId === 'staff-real-1', 'Authenticated principal must come from server context.');
assert(businessCommand.sender.actorId === 'business-1', 'Requested business actor must remain visible actor.');
assert(businessCommand.sender.principalUserId === 'staff-real-1', 'Server must inject real staff principal for authorization/audit.');
assert(businessCommand.createdAt === '2026-09-17T20:00:00.000Z', 'Message timestamp must be server-assigned.');

const userCommand = sendCommandFromApi({
  principalUserId: 'user-1',
  conversationId: 'conv-1',
  serverNow: '2026-09-17T20:01:00.000Z',
  request: {
    client_message_id: 'offline-mutation-101',
    message_type: 'text',
    body: 'Gracias.',
  },
});
assert(userCommand.sender.actorType === 'user' && userCommand.sender.actorId === 'user-1', 'Default API sender must be authenticated user actor.');
assert(userCommand.sender.principalUserId === undefined, 'Normal user message does not need duplicate principal field.');

const canonical: Message = {
  messageId: 'message-1',
  conversationId: 'conv-1',
  scopeId: 'scope-order-1',
  clientMessageId: 'offline-mutation-100',
  sender: {
    actorType: 'business',
    actorId: 'business-1',
    principalUserId: 'staff-real-1',
  },
  sequence: 8,
  type: 'text',
  body: 'Tu pedido salió a reparto.',
  createdAt: '2026-09-17T20:00:00.000Z',
};
const apiMessage = messageToApi(canonical, false);
assert(apiMessage.sender.actor_id === 'business-1', 'Client response must show business actor.');
assert(!('principal_user_id' in apiMessage.sender), 'Client response must not expose internal staff principal audit field.');
assert(!JSON.stringify(apiMessage).includes('staff-real-1'), 'Serialized public message must not leak staff principal identity.');

const page = buildMessageListResponse({
  messages: [canonical, { ...canonical, messageId: 'message-2', clientMessageId: 'offline-mutation-102', sequence: 9 }],
  requestedLimit: 2,
});
assert(page.next_after_sequence === 9, 'Sync page must return cursor from last canonical sequence.');
assert(page.has_more, 'Full page must advertise possible next page.');

console.log('Message API contract tests passed.');
