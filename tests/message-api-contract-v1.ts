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

const voiceCommand = sendCommandFromApi({
  principalUserId: 'user-1',
  conversationId: 'conv-1',
  serverNow: '2026-09-17T20:02:00.000Z',
  request: {
    client_message_id: 'offline-mutation-voice-1',
    scope_id: 'scope-order-1',
    message_type: 'voice',
    attachments: [
      {
        asset_id: 'asset-message-voice-1',
        kind: 'voice',
        mime_type: 'audio/ogg',
        size_bytes: 42000,
        duration_ms: 6100,
      },
    ],
  },
});
assert(voiceCommand.attachments?.[0]?.assetId === 'asset-message-voice-1', 'API request must map provider-neutral asset ID into Message command.');
assert(voiceCommand.attachments?.[0]?.durationMs === 6100, 'Voice duration metadata must survive API mapping.');

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

const canonicalVoice: Message = {
  messageId: 'message-voice-1',
  conversationId: 'conv-1',
  scopeId: 'scope-order-1',
  clientMessageId: 'offline-mutation-voice-1',
  sender: { actorType: 'user', actorId: 'user-1' },
  sequence: 9,
  type: 'voice',
  attachments: [
    {
      attachmentId: 'attachment-voice-1',
      messageId: 'message-voice-1',
      assetId: 'asset-message-voice-1',
      kind: 'voice',
      mimeType: 'audio/ogg',
      sizeBytes: 42000,
      durationMs: 6100,
    },
  ],
  createdAt: '2026-09-17T20:02:00.000Z',
};
const apiVoice = messageToApi(canonicalVoice);
assert(apiVoice.attachments?.[0]?.asset_id === 'asset-message-voice-1', 'Public API must expose Palta asset ID for authorized media fetch flow.');
assert(apiVoice.attachments?.[0]?.attachment_id === 'attachment-voice-1', 'Public API must expose canonical attachment identity.');
const serializedVoice = JSON.stringify(apiVoice).toLowerCase();
for (const providerMarker of ['amazonaws', 'cloudflare', 'r2.dev', 'supabase', 'cloudinary', 'https://']) {
  assert(!serializedVoice.includes(providerMarker), `Message API must not expose storage provider marker ${providerMarker}.`);
}

const page = buildMessageListResponse({
  messages: [canonical, canonicalVoice],
  requestedLimit: 2,
});
assert(page.next_after_sequence === 9, 'Sync page must return cursor from last canonical sequence.');
assert(page.has_more, 'Full page must advertise possible next page.');

console.log('Message API contract tests passed.');
