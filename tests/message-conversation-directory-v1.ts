import type { MessageActorAuthorizationPort } from '../src/messaging/authorizationPort.js';
import type {
  ActorRef,
  Conversation,
} from '../src/messaging/contracts.js';
import type {
  ConversationDirectoryPort,
  ConversationInboxCursor,
  ConversationInboxItem,
  EnsureOneToOneConversationInput,
  EnsureOneToOneConversationResult,
} from '../src/messaging/conversationDirectoryPort.js';
import {
  ConversationDirectoryError,
  ConversationDirectoryService,
} from '../src/messaging/conversationDirectoryService.js';
import type { BusinessConversationEligibilityPort } from '../src/messaging/conversationEligibilityPort.js';
import {
  canonicalConversationPair,
  oneToOneConversationIdentityKey,
} from '../src/messaging/conversationIdentity.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectCode(
  code: ConversationDirectoryError['code'],
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    assert(error instanceof ConversationDirectoryError, `Expected ConversationDirectoryError(${code}).`);
    assert(error.code === code, `Expected ${code}, received ${error.code}.`);
    return;
  }
  throw new Error(`Expected ConversationDirectoryError(${code}).`);
}

class FakeConversationDirectory implements ConversationDirectoryPort {
  readonly conversations = new Map<string, Conversation>();
  readonly actorsByConversation = new Map<string, ActorRef[]>();
  readonly inboxByActor = new Map<string, ConversationInboxItem[]>();

  async ensureOneToOne(
    input: EnsureOneToOneConversationInput,
  ): Promise<EnsureOneToOneConversationResult> {
    const key = oneToOneConversationIdentityKey(input.first.actor, input.second.actor);
    const existing = this.conversations.get(key);
    if (existing) return { conversation: existing, created: false };

    const conversation: Conversation = {
      conversationId: input.conversationId,
      type: input.type,
      lastSequence: 0,
      lastActivityAt: input.createdAt,
      createdAt: input.createdAt,
    };
    this.conversations.set(key, conversation);
    this.actorsByConversation.set(input.conversationId, [
      { ...input.first.actor },
      { ...input.second.actor },
    ]);
    return { conversation, created: true };
  }

  async listForActor(input: {
    actor: ActorRef;
    cursor?: ConversationInboxCursor;
    limit: number;
  }): Promise<ConversationInboxItem[]> {
    const key = `${input.actor.actorType}:${input.actor.actorId}`;
    const items = this.inboxByActor.get(key) ?? [];
    const filtered = input.cursor
      ? items.filter((item) => {
          const activity = item.conversation.lastActivityAt;
          return (
            activity < input.cursor!.lastActivityAt ||
            (activity === input.cursor!.lastActivityAt &&
              item.conversation.conversationId < input.cursor!.conversationId)
          );
        })
      : items;
    return filtered.slice(0, input.limit);
  }
}

const user: ActorRef = { actorType: 'user', actorId: 'user-1' };
const business: ActorRef = { actorType: 'business', actorId: 'business-1' };
const [pairA, pairB] = canonicalConversationPair(user, business);
const [reverseA, reverseB] = canonicalConversationPair(business, user);
assert(pairA.actorType === reverseA.actorType && pairA.actorId === reverseA.actorId, 'Canonical one-to-one identity must not depend on actor order.');
assert(pairB.actorType === reverseB.actorType && pairB.actorId === reverseB.actorId, 'Canonical pair second actor must be stable.');
assert(
  oneToOneConversationIdentityKey(user, business) ===
    oneToOneConversationIdentityKey(business, user),
  'Reversed actor order must resolve to the same durable relationship identity.',
);

const directory = new FakeConversationDirectory();
const eligibleBusinesses = new Set(['business-1', 'business-2']);
const businessEligibility: BusinessConversationEligibilityPort = {
  canOpenUserBusinessConversation: async ({ businessId }) =>
    eligibleBusinesses.has(businessId),
};
const actorAuthorization: MessageActorAuthorizationPort = {
  canActAs: async ({ principalUserId, actor }) =>
    actor.actorType === 'business' &&
    actor.actorId === 'business-1' &&
    principalUserId === 'staff-allowed',
};
let conversationIds = 0;
const service = new ConversationDirectoryService(
  directory,
  actorAuthorization,
  businessEligibility,
  {
    nextConversationId: () =>
      `00000000-0000-4000-8000-${String(++conversationIds).padStart(12, '0')}`,
  },
);

const opened = await service.openUserBusinessConversation({
  principalUserId: 'user-1',
  businessId: 'business-1',
  createdAt: '2026-09-17T20:20:00.000Z',
});
assert(opened.created, 'First user-business open must create a durable conversation.');

const reopened = await service.openUserBusinessConversation({
  principalUserId: 'user-1',
  businessId: 'business-1',
  createdAt: '2026-09-17T20:21:00.000Z',
});
assert(!reopened.created, 'Opening the same business relationship again must reuse the conversation.');
assert(reopened.conversation.conversationId === opened.conversation.conversationId, 'Same user-business pair must return the same conversation ID.');
assert(Number(directory.conversations.size) === 1, 'Repeated business entry points must not create duplicate chats.');

const reverseEnsure = await directory.ensureOneToOne({
  conversationId: 'should-not-be-used',
  type: 'business',
  first: { actor: business, role: 'member' },
  second: { actor: user, role: 'customer' },
  createdAt: '2026-09-17T20:22:00.000Z',
});
assert(!reverseEnsure.created, 'Reversed actor order must reuse existing relationship identity.');
assert(reverseEnsure.conversation.conversationId === opened.conversation.conversationId, 'Reversed actor pair must resolve to same conversation.');

const otherBusiness = await service.openUserBusinessConversation({
  principalUserId: 'user-1',
  businessId: 'business-2',
  createdAt: '2026-09-17T20:23:00.000Z',
});
assert(otherBusiness.created, 'A different business must create a different relationship conversation.');
assert(otherBusiness.conversation.conversationId !== opened.conversation.conversationId, 'Different business must not share conversation identity.');

await expectCode('BUSINESS_MESSAGING_UNAVAILABLE', () =>
  service.openUserBusinessConversation({
    principalUserId: 'user-1',
    businessId: 'business-unclaimed',
    createdAt: '2026-09-17T20:24:00.000Z',
  }),
);
assert(Number(directory.conversations.size) === 2, 'Unavailable business messaging must not create a conversation.');

const userInboxItems: ConversationInboxItem[] = [
  {
    conversation: {
      ...opened.conversation,
      lastSequence: 7,
      lastActivityAt: '2026-09-17T20:30:00.000Z',
    },
    counterpartActors: [business],
    unreadCount: 2,
    lastMessage: {
      messageId: 'message-7',
      sequence: 7,
      type: 'text',
      body: 'Tu pedido sale hoy.',
      createdAt: '2026-09-17T20:30:00.000Z',
    },
  },
  {
    conversation: {
      ...otherBusiness.conversation,
      lastSequence: 3,
      lastActivityAt: '2026-09-17T20:25:00.000Z',
    },
    counterpartActors: [{ actorType: 'business', actorId: 'business-2' }],
    unreadCount: 0,
  },
];
directory.inboxByActor.set('user:user-1', userInboxItems);
const businessInboxSeed: ConversationInboxItem = {
  conversation: userInboxItems[0]!.conversation,
  counterpartActors: [user],
  unreadCount: 1,
  ...(userInboxItems[0]!.lastMessage !== undefined
    ? { lastMessage: userInboxItems[0]!.lastMessage }
    : {}),
};
directory.inboxByActor.set('business:business-1', [businessInboxSeed]);

const inbox = await service.listInbox({
  principalUserId: 'user-1',
  actor: user,
  limit: 30,
});
assert(Number(inbox.length) === 2, 'Authenticated user must be able to list own relationship Inbox.');
assert(inbox[0]?.unreadCount === 2, 'Inbox must preserve incoming-only unread count from persistence boundary.');
assert(inbox[0]?.counterpartActors[0]?.actorId === 'business-1', 'Inbox exposes counterpart actor reference, not copied business/customer PII.');
const inboxJson = JSON.stringify(inbox).toLowerCase();
for (const forbidden of ['phone', 'email', 'address', 'bearer', 'token', 'principaluserid']) {
  assert(!inboxJson.includes(forbidden), `Inbox contract must not copy ${forbidden}.`);
}

const paged = await service.listInbox({
  principalUserId: 'user-1',
  actor: user,
  cursor: {
    lastActivityAt: '2026-09-17T20:30:00.000Z',
    conversationId: opened.conversation.conversationId,
  },
  limit: 30,
});
assert(Number(paged.length) === 1 && paged[0]?.conversation.conversationId === otherBusiness.conversation.conversationId, 'Inbox keyset cursor must continue after activity/id pair without offset pagination.');

await expectCode('ACTOR_NOT_AUTHORIZED', () =>
  service.listInbox({
    principalUserId: 'staff-denied',
    actor: {
      actorType: 'business',
      actorId: 'business-1',
      principalUserId: 'staff-denied',
    },
  }),
);

const businessInbox = await service.listInbox({
  principalUserId: 'staff-allowed',
  actor: {
    actorType: 'business',
    actorId: 'business-1',
    principalUserId: 'staff-allowed',
  },
});
assert(Number(businessInbox.length) === 1, 'Authorized business staff must be able to list the business Inbox.');
assert(businessInbox[0]?.counterpartActors[0]?.actorId === 'user-1', 'Business Inbox must identify counterpart by Palta actor reference.');

console.log('Message conversation directory tests passed.');
