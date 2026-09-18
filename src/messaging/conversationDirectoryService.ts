import type { MessageActorAuthorizationPort } from './authorizationPort.js';
import { selfAuthorizesUserActor } from './authorizationPort.js';
import type { ActorRef, Conversation } from './contracts.js';
import type {
  ConversationDirectoryPort,
  ConversationInboxCursor,
  ConversationInboxItem,
} from './conversationDirectoryPort.js';
import type {
  BusinessConversationEligibilityPort,
  DirectUserConversationEligibilityPort,
} from './conversationEligibilityPort.js';

export interface ConversationDirectoryRuntime {
  nextConversationId(): string;
}

export class ConversationDirectoryError extends Error {
  constructor(
    readonly code:
      | 'INVALID_CONVERSATION_REQUEST'
      | 'ACTOR_NOT_AUTHORIZED'
      | 'BUSINESS_MESSAGING_UNAVAILABLE'
      | 'DIRECT_USER_MESSAGING_UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'ConversationDirectoryError';
  }
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ConversationDirectoryError(
      'INVALID_CONVERSATION_REQUEST',
      `${label} is required.`,
    );
  }
  return normalized;
}

export class ConversationDirectoryService {
  constructor(
    private readonly directory: ConversationDirectoryPort,
    private readonly actorAuthorization: MessageActorAuthorizationPort,
    private readonly businessEligibility: BusinessConversationEligibilityPort,
    private readonly runtime: ConversationDirectoryRuntime,
    private readonly directUserEligibility?: DirectUserConversationEligibilityPort,
  ) {}

  private async assertActorReadAuthority(
    principalUserId: string,
    actor: ActorRef,
  ): Promise<void> {
    if (selfAuthorizesUserActor(principalUserId, actor)) return;
    if (actor.actorType === 'user' || actor.principalUserId !== principalUserId) {
      throw new ConversationDirectoryError(
        'ACTOR_NOT_AUTHORIZED',
        'Authenticated principal cannot read the requested inbox actor.',
      );
    }
    const allowed = await this.actorAuthorization.canActAs({
      principalUserId,
      actor,
      operation: 'read',
    });
    if (!allowed) {
      throw new ConversationDirectoryError(
        'ACTOR_NOT_AUTHORIZED',
        'Authenticated principal cannot read the requested inbox actor.',
      );
    }
  }

  async openUserBusinessConversation(input: {
    principalUserId: string;
    businessId: string;
    createdAt: string;
  }): Promise<{ conversation: Conversation; created: boolean }> {
    const userId = required(input.principalUserId, 'principalUserId');
    const businessId = required(input.businessId, 'businessId');
    const available = await this.businessEligibility.canOpenUserBusinessConversation({
      userId,
      businessId,
    });
    if (!available) {
      throw new ConversationDirectoryError(
        'BUSINESS_MESSAGING_UNAVAILABLE',
        'Palta internal messaging is not available for this business.',
      );
    }

    return this.directory.ensureOneToOne({
      conversationId: this.runtime.nextConversationId(),
      type: 'business',
      first: {
        actor: { actorType: 'user', actorId: userId },
        role: 'customer',
      },
      second: {
        actor: { actorType: 'business', actorId: businessId },
        role: 'member',
      },
      createdAt: input.createdAt,
    });
  }

  async openUserDirectConversation(input: {
    principalUserId: string;
    counterpartUserId: string;
    createdAt: string;
  }): Promise<{ conversation: Conversation; created: boolean }> {
    const initiatorUserId = required(input.principalUserId, 'principalUserId');
    const counterpartUserId = required(input.counterpartUserId, 'counterpartUserId');

    if (initiatorUserId === counterpartUserId) {
      throw new ConversationDirectoryError(
        'INVALID_CONVERSATION_REQUEST',
        'A user cannot open a direct conversation with themselves.',
      );
    }

    if (!this.directUserEligibility) {
      throw new ConversationDirectoryError(
        'DIRECT_USER_MESSAGING_UNAVAILABLE',
        'Direct user messaging is not configured for this runtime.',
      );
    }

    const available = await this.directUserEligibility.canOpenDirectUserConversation({
      initiatorUserId,
      counterpartUserId,
    });
    if (!available) {
      throw new ConversationDirectoryError(
        'DIRECT_USER_MESSAGING_UNAVAILABLE',
        'Direct Palta messaging is not available for this user relationship.',
      );
    }

    return this.directory.ensureOneToOne({
      conversationId: this.runtime.nextConversationId(),
      type: 'direct',
      first: {
        actor: { actorType: 'user', actorId: initiatorUserId },
        role: 'member',
      },
      second: {
        actor: { actorType: 'user', actorId: counterpartUserId },
        role: 'member',
      },
      createdAt: input.createdAt,
    });
  }

  async listInbox(input: {
    principalUserId: string;
    actor: ActorRef;
    cursor?: ConversationInboxCursor;
    limit?: number;
  }): Promise<ConversationInboxItem[]> {
    required(input.principalUserId, 'principalUserId');
    required(input.actor.actorId, 'actor.actorId');
    await this.assertActorReadAuthority(input.principalUserId, input.actor);
    const limit = Math.min(100, Math.max(1, Math.trunc(input.limit ?? 30)));
    return this.directory.listForActor({
      actor: input.actor,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      limit,
    });
  }
}
