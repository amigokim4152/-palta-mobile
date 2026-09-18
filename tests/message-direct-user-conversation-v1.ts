import type { MessageActorAuthorizationPort } from '../src/messaging/authorizationPort.js';
import type { ActorRef, Conversation } from '../src/messaging/contracts.js';
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
import type {
  BusinessConversationEligibilityPort,
  DirectUserConversationEligibilityPort,
} from '../src/messaging/conversationEligibilityPort.js';
import { oneToOneConversationIdentityKey } from '../src/messaging/conversationIdentity.js';

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
  readonly ensureInputs: EnsureOneToOneConversationInput[] = [];

  async ensureOneToOne(
    input: EnsureOneToOneConversationInput,
  ): Promise<EnsureOneToOneConversationResult> {
    this.ensureInputs.push(input);
    const key = oneToOneConversationIdentityKey(input.first.actor, input.second.actor);
    const existing = this.conversations.get(key);
    if (existing) return { conversation: existing, created: false };

    const conversation: Conversation = {
      conversationId: input.conversationId,
      type: input.type,
      createdAt: input.createdAt,
      lastSequence: 0,
      lastActivityAt: input.createdAt,
    };
    this.conversations.set(key, conversation);
    return { conversation, created: true };
  }

  async listForActor(_input: {
    actor: ActorRef;
    cursor?: ConversationInboxCursor;
    limit: number;
  }): Promise<ConversationInboxItem[]> {
    return [];
  }
}

const directory = new FakeConversationDirectory();
const actorAuthorization: MessageActorAuthorizationPort = {
  canActAs: async () => false,
};
const businessEligibility: BusinessConversationEligibilityPort = {
  canOpenUserBusinessConversation: async () => true,
};
const directEligibility: DirectUserConversationEligibilityPort = {
  canOpenDirectUserConversation: async ({ initiatorUserId, counterpartUserId }) =>
    !initiatorUserId.startsWith('blocked-') && !counterpartUserId.startsWith('blocked-'),
};

let sequence = 0;
const service = new ConversationDirectoryService(
  directory,
  actorAuthorization,
  businessEligibility,
  {
    nextConversationId: () =>
      `10000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`,
  },
  directEligibility,
);

const opened = await service.openUserDirectConversation({
  principalUserId: 'user-1',
  counterpartUserId: 'user-2',
  createdAt: '2026-09-18T13:00:00.000Z',
});
assert(opened.created, 'First direct user open must create a conversation.');
assert(opened.conversation.type === 'direct', 'User-to-user relationship must use direct conversation type.');
const firstEnsure = directory.ensureInputs[0];
assert(firstEnsure?.first.role === 'member' && firstEnsure.second.role === 'member', 'Direct user participants must both use member role.');

const reopened = await service.openUserDirectConversation({
  principalUserId: 'user-1',
  counterpartUserId: 'user-2',
  createdAt: '2026-09-18T13:01:00.000Z',
});
assert(!reopened.created, 'Repeated direct user open must reuse the relationship conversation.');
assert(reopened.conversation.conversationId === opened.conversation.conversationId, 'Repeated direct user open must return the same conversation ID.');

const reversed = await service.openUserDirectConversation({
  principalUserId: 'user-2',
  counterpartUserId: 'user-1',
  createdAt: '2026-09-18T13:02:00.000Z',
});
assert(!reversed.created, 'Reversing initiator/counterpart must reuse the same direct relationship.');
assert(reversed.conversation.conversationId === opened.conversation.conversationId, 'Direct relationship identity must be actor-order independent.');
assert(directory.conversations.size === 1, 'Same two users must have one durable direct conversation.');

const other = await service.openUserDirectConversation({
  principalUserId: 'user-1',
  counterpartUserId: 'user-3',
  createdAt: '2026-09-18T13:03:00.000Z',
});
assert(other.created, 'A different counterpart must create a different direct conversation.');
assert(other.conversation.conversationId !== opened.conversation.conversationId, 'Different user pair must not share a conversation.');

await expectCode('INVALID_CONVERSATION_REQUEST', () =>
  service.openUserDirectConversation({
    principalUserId: 'user-1',
    counterpartUserId: 'user-1',
    createdAt: '2026-09-18T13:04:00.000Z',
  }),
);
assert(directory.conversations.size === 2, 'Self-conversation rejection must not create persistence state.');

await expectCode('DIRECT_USER_MESSAGING_UNAVAILABLE', () =>
  service.openUserDirectConversation({
    principalUserId: 'user-1',
    counterpartUserId: 'blocked-user-4',
    createdAt: '2026-09-18T13:05:00.000Z',
  }),
);
assert(directory.conversations.size === 2, 'Eligibility rejection must fail before creating a conversation.');

const unconfiguredService = new ConversationDirectoryService(
  new FakeConversationDirectory(),
  actorAuthorization,
  businessEligibility,
  { nextConversationId: () => '20000000-0000-4000-8000-000000000001' },
);
await expectCode('DIRECT_USER_MESSAGING_UNAVAILABLE', () =>
  unconfiguredService.openUserDirectConversation({
    principalUserId: 'user-1',
    counterpartUserId: 'user-2',
    createdAt: '2026-09-18T13:06:00.000Z',
  }),
);

console.log('Message direct user conversation tests passed.');
