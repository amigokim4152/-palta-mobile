import type { MessageActorAuthorizationPort } from '../src/messaging/authorizationPort.js';
import type { MessageAttachmentAuthorizationPort } from '../src/messaging/attachmentAuthorizationPort.js';
import type {
  ActorRef,
  ConversationScope,
  Message,
  MessageAttachment,
  OutboxEvent,
  ParticipantState,
} from '../src/messaging/contracts.js';
import {
  MessageService,
  MessageServiceError,
} from '../src/messaging/messageService.js';
import type {
  LockedConversationState,
  MessagePersistencePort,
  MessagePersistenceTransaction,
} from '../src/messaging/persistencePort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectCode(
  code: MessageServiceError['code'],
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    assert(error instanceof MessageServiceError, `Expected MessageServiceError(${code}).`);
    assert(error.code === code, `Expected ${code}, received ${error.code}.`);
    return;
  }
  throw new Error(`Expected MessageServiceError(${code}).`);
}

class FakePersistence implements MessagePersistencePort {
  conversation: LockedConversationState = {
    conversationId: 'conv-1',
    lastSequence: 0,
    lastActivityAt: '2026-09-17T18:00:00.000Z',
  };
  participants: ParticipantState[] = [];
  scopes: ConversationScope[] = [];
  messages: Message[] = [];
  attachments: MessageAttachment[] = [];
  outbox: OutboxEvent[] = [];
  failOutbox = false;

  async transaction<T>(
    run: (tx: MessagePersistenceTransaction) => Promise<T>,
  ): Promise<T> {
    const snapshot = {
      conversation: { ...this.conversation },
      participants: this.participants.map((item) => ({
        ...item,
        actor: { ...item.actor },
      })),
      messages: this.messages.slice(),
      attachments: this.attachments.slice(),
      outbox: this.outbox.slice(),
    };
    const tx: MessagePersistenceTransaction = {
      findMessageByIdempotency: async (input) =>
        this.messages.find(
          (message) =>
            message.conversationId === input.conversationId &&
            message.sender.actorType === input.sender.actorType &&
            message.sender.actorId === input.sender.actorId &&
            message.clientMessageId === input.clientMessageId,
        ) ?? null,
      lockConversation: async (conversationId) =>
        this.conversation.conversationId === conversationId
          ? { ...this.conversation }
          : null,
      findParticipant: async (input) =>
        this.participants.find(
          (participant) =>
            participant.conversationId === input.conversationId &&
            participant.actor.actorType === input.actor.actorType &&
            participant.actor.actorId === input.actor.actorId,
        ) ?? null,
      findScope: async (scopeId) =>
        this.scopes.find((scope) => scope.scopeId === scopeId) ?? null,
      insertMessage: async (message) => {
        this.messages.push(message);
      },
      insertAttachments: async (attachments) => {
        this.attachments.push(...attachments);
      },
      updateConversationSequence: async (input) => {
        this.conversation = {
          conversationId: input.conversationId,
          lastSequence: input.lastSequence,
          lastActivityAt: input.lastActivityAt,
        };
      },
      advanceRead: async (input) => {
        const index = this.participants.findIndex(
          (participant) =>
            participant.conversationId === input.conversationId &&
            participant.actor.actorType === input.actor.actorType &&
            participant.actor.actorId === input.actor.actorId &&
            participant.leftAt === undefined,
        );
        if (index < 0) return null;
        const current = this.participants[index];
        if (!current) return null;
        const capped = Math.min(input.throughSequence, this.conversation.lastSequence);
        const nextRead = Math.max(current.lastReadSequence, capped);
        const nextDelivered = Math.max(current.lastDeliveredSequence, nextRead);
        const next = {
          ...current,
          lastReadSequence: nextRead,
          lastDeliveredSequence: nextDelivered,
        };
        this.participants[index] = next;
        return next;
      },
      insertOutbox: async (event) => {
        if (this.failOutbox) throw new Error('OUTBOX_INSERT_FAILED');
        this.outbox.push(event);
      },
    };

    try {
      return await run(tx);
    } catch (error) {
      this.conversation = snapshot.conversation;
      this.participants = snapshot.participants;
      this.messages = snapshot.messages;
      this.attachments = snapshot.attachments;
      this.outbox = snapshot.outbox;
      throw error;
    }
  }

  async listAfter(input: {
    conversationId: string;
    afterSequence: number;
    limit: number;
  }): Promise<Message[]> {
    return this.messages
      .filter(
        (message) =>
          message.conversationId === input.conversationId &&
          message.sequence > input.afterSequence,
      )
      .sort((a, b) => a.sequence - b.sequence)
      .slice(0, input.limit);
  }
}

function participant(actor: ActorRef): ParticipantState {
  return {
    conversationId: 'conv-1',
    actor,
    role: actor.actorType === 'business' ? 'staff' : 'customer',
    joinedAt: '2026-09-17T18:00:00.000Z',
    lastDeliveredSequence: 0,
    lastReadSequence: 0,
    muted: false,
    archived: false,
  };
}

const persistence = new FakePersistence();
const userActor: ActorRef = { actorId: 'user-1', actorType: 'user' };
persistence.participants.push(participant(userActor));
persistence.scopes.push({
  scopeId: 'scope-1',
  conversationId: 'conv-1',
  scopeType: 'shipment',
  label: 'Pedido #1001',
  state: 'active',
  createdAt: '2026-09-17T18:30:00.000Z',
});

const allowedBusinessPrincipals = new Set(['staff-allowed']);
const authorization: MessageActorAuthorizationPort = {
  canActAs: async ({ principalUserId, actor }) =>
    actor.actorType === 'business' && allowedBusinessPrincipals.has(principalUserId),
};
const attachmentAuthorization: MessageAttachmentAuthorizationPort = {
  canAttach: async ({ principalUserId, attachment }) =>
    principalUserId === 'user-1' && attachment.assetId.startsWith('asset-owned-'),
};
let ids = 0;
let attachmentIds = 0;
const service = new MessageService(
  persistence,
  authorization,
  {
    nextMessageId: () => `00000000-0000-4000-8000-${String(++ids).padStart(12, '0')}`,
    nextOutboxEventId: () => `10000000-0000-4000-8000-${String(ids).padStart(12, '0')}`,
    nextAttachmentId: () => `20000000-0000-4000-8000-${String(++attachmentIds).padStart(12, '0')}`,
  },
  attachmentAuthorization,
);

const first = await service.send({
  principalUserId: 'user-1',
  conversationId: 'conv-1',
  scopeId: 'scope-1',
  clientMessageId: 'offline-mutation-1',
  sender: userActor,
  type: 'text',
  body: '¿Dónde viene mi pedido?',
  createdAt: '2026-09-17T19:00:00.000Z',
});
assert(!first.replayed, 'First send must persist a new message.');
assert(first.message.sequence === 1, 'First message must allocate sequence 1.');
assert(first.message.scopeId === 'scope-1', 'Scoped message must preserve shipment/order scope.');
assert(persistence.messages.length === 1, 'Exactly one message must be persisted.');
assert(persistence.outbox.length === 1, 'Message and outbox must be persisted together.');
assert(persistence.outbox[0]?.payload?.conversationId === 'conv-1', 'Outbox must contain routing metadata, not canonical payload.');

const replay = await service.send({
  principalUserId: 'user-1',
  conversationId: 'conv-1',
  scopeId: 'scope-1',
  clientMessageId: 'offline-mutation-1',
  sender: userActor,
  type: 'text',
  body: '¿Dónde viene mi pedido?',
  createdAt: '2026-09-17T19:00:02.000Z',
});
assert(replay.replayed, 'Offline retry with same clientMessageId must replay existing result.');
assert(replay.message.messageId === first.message.messageId, 'Retry must return same canonical message.');
assert(persistence.conversation.lastSequence === 1, 'Retry must not consume another sequence.');
assert(persistence.messages.length === 1 && persistence.outbox.length === 1, 'Retry must not duplicate message or outbox.');

const deniedBusinessActor: ActorRef = {
  actorId: 'business-1',
  actorType: 'business',
  principalUserId: 'staff-denied',
};
await expectCode('ACTOR_NOT_AUTHORIZED', () =>
  service.send({
    principalUserId: 'staff-denied',
    conversationId: 'conv-1',
    clientMessageId: 'business-denied-1',
    sender: deniedBusinessActor,
    type: 'text',
    body: 'No autorizado',
    createdAt: '2026-09-17T19:01:00.000Z',
  }),
);
assert(persistence.messages.length === 1, 'Denied business impersonation must not persist a message.');

const allowedBusinessActor: ActorRef = {
  actorId: 'business-1',
  actorType: 'business',
  principalUserId: 'staff-allowed',
};
persistence.participants.push(participant(allowedBusinessActor));
const businessReply = await service.send({
  principalUserId: 'staff-allowed',
  conversationId: 'conv-1',
  scopeId: 'scope-1',
  clientMessageId: 'business-reply-1',
  sender: allowedBusinessActor,
  type: 'text',
  body: 'Sale a reparto hoy.',
  createdAt: '2026-09-17T19:02:00.000Z',
});
assert(businessReply.message.sender.actorId === 'business-1', 'Customer sees the business actor as sender.');
assert(businessReply.message.sender.principalUserId === 'staff-allowed', 'Audit trail must preserve the actual staff principal.');

persistence.scopes.push({
  scopeId: 'scope-other-conversation',
  conversationId: 'conv-2',
  scopeType: 'order',
  state: 'active',
  createdAt: '2026-09-17T18:30:00.000Z',
});
await expectCode('SCOPE_CONVERSATION_MISMATCH', () =>
  service.send({
    principalUserId: 'user-1',
    conversationId: 'conv-1',
    scopeId: 'scope-other-conversation',
    clientMessageId: 'bad-scope-1',
    sender: userActor,
    type: 'text',
    body: 'Wrong scope',
    createdAt: '2026-09-17T19:03:00.000Z',
  }),
);

await expectCode('INVALID_MESSAGE', () =>
  service.send({
    principalUserId: 'user-1',
    conversationId: 'conv-1',
    clientMessageId: 'voice-without-asset',
    sender: userActor,
    type: 'voice',
    createdAt: '2026-09-17T19:03:10.000Z',
  }),
);

await expectCode('ATTACHMENT_NOT_AUTHORIZED', () =>
  service.send({
    principalUserId: 'user-1',
    conversationId: 'conv-1',
    scopeId: 'scope-1',
    clientMessageId: 'voice-foreign-asset',
    sender: userActor,
    type: 'voice',
    attachments: [
      {
        assetId: 'asset-foreign-voice-1',
        kind: 'voice',
        mimeType: 'audio/ogg',
        durationMs: 4200,
        sizeBytes: 32000,
      },
    ],
    createdAt: '2026-09-17T19:03:20.000Z',
  }),
);
assert(persistence.attachments.length === 0, 'Unauthorized asset must not create attachment rows.');

const voice = await service.send({
  principalUserId: 'user-1',
  conversationId: 'conv-1',
  scopeId: 'scope-1',
  clientMessageId: 'voice-owned-asset',
  sender: userActor,
  type: 'voice',
  attachments: [
    {
      assetId: 'asset-owned-voice-1',
      kind: 'voice',
      mimeType: 'audio/ogg',
      durationMs: 4200,
      sizeBytes: 32000,
    },
  ],
  createdAt: '2026-09-17T19:03:30.000Z',
});
assert(voice.message.attachments?.length === 1, 'Authorized voice message must expose one canonical attachment.');
assert(voice.message.attachments?.[0]?.assetId === 'asset-owned-voice-1', 'Voice message must reference provider-neutral asset ID.');
assert(persistence.attachments.length === 1, 'Voice attachment must persist in same Message transaction.');
assert(!JSON.stringify(voice.outboxEvent).includes('asset-owned-voice-1'), 'Outbox routing event must not copy attachment identifiers or payload.');

const beforeFailure = {
  messageCount: persistence.messages.length,
  attachmentCount: persistence.attachments.length,
  outboxCount: persistence.outbox.length,
  lastSequence: persistence.conversation.lastSequence,
};
persistence.failOutbox = true;
try {
  await service.send({
    principalUserId: 'user-1',
    conversationId: 'conv-1',
    scopeId: 'scope-1',
    clientMessageId: 'rollback-voice-1',
    sender: userActor,
    type: 'voice',
    attachments: [
      {
        assetId: 'asset-owned-voice-rollback',
        kind: 'voice',
        mimeType: 'audio/ogg',
        durationMs: 1000,
      },
    ],
    createdAt: '2026-09-17T19:04:00.000Z',
  });
  throw new Error('Expected outbox persistence failure.');
} catch (error) {
  assert(error instanceof Error, 'Expected transaction error.');
}
persistence.failOutbox = false;
assert(persistence.messages.length === beforeFailure.messageCount, 'Outbox failure must roll back message insert.');
assert(persistence.attachments.length === beforeFailure.attachmentCount, 'Outbox failure must roll back attachment insert.');
assert(persistence.outbox.length === beforeFailure.outboxCount, 'Outbox failure must leave outbox unchanged.');
assert(persistence.conversation.lastSequence === beforeFailure.lastSequence, 'Outbox failure must roll back sequence advancement.');

const afterSequenceOne = await service.listAfter({
  principalUserId: 'user-1',
  conversationId: 'conv-1',
  actor: userActor,
  afterSequence: 1,
  limit: 50,
});
assert(afterSequenceOne.length === 2, 'Cursor sync must return messages after the requested sequence.');
assert(afterSequenceOne[0]?.messageId === businessReply.message.messageId, 'Cursor sync must preserve conversation order.');
assert(afterSequenceOne[1]?.messageId === voice.message.messageId, 'Cursor sync must include voice message in canonical order.');

const outboxBeforeRead = persistence.outbox.length;
const read = await service.advanceRead({
  principalUserId: 'user-1',
  conversationId: 'conv-1',
  actor: userActor,
  throughSequence: 999,
  occurredAt: '2026-09-17T19:05:00.000Z',
});
assert(read.lastReadSequence === persistence.conversation.lastSequence, 'Read cursor must be capped at canonical conversation sequence.');
assert(read.lastDeliveredSequence >= read.lastReadSequence, 'Read cursor must also advance delivered cursor.');
assert(persistence.outbox.length === outboxBeforeRead + 1, 'Forward read movement must emit one outbox event.');
assert(persistence.outbox.at(-1)?.eventType === 'participant.read_advanced', 'Read movement must emit participant.read_advanced.');

const outboxAfterRead = persistence.outbox.length;
const readAgain = await service.advanceRead({
  principalUserId: 'user-1',
  conversationId: 'conv-1',
  actor: userActor,
  throughSequence: 1,
  occurredAt: '2026-09-17T19:05:10.000Z',
});
assert(readAgain.lastReadSequence === read.lastReadSequence, 'Read cursor must never move backwards.');
assert(persistence.outbox.length === outboxAfterRead, 'Non-advancing read update must not emit duplicate realtime work.');

console.log('Message application service tests passed.');
