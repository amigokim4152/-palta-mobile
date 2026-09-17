import type { MessageActorAuthorizationPort } from './authorizationPort.js';
import { selfAuthorizesUserActor } from './authorizationPort.js';
import type {
  ActionReference,
  ActorRef,
  Message,
  MessageType,
  OutboxEvent,
} from './contracts.js';
import type { MessagePersistencePort } from './persistencePort.js';

export interface MessageServiceRuntime {
  nextMessageId(): string;
  nextOutboxEventId(): string;
}

export interface SendMessageCommand {
  principalUserId: string;
  conversationId: string;
  scopeId?: string;
  clientMessageId: string;
  sender: ActorRef;
  type: MessageType;
  body?: string;
  replyToMessageId?: string;
  actionRef?: ActionReference;
  createdAt: string;
}

export interface SendMessageResult {
  message: Message;
  outboxEvent?: OutboxEvent;
  replayed: boolean;
}

export class MessageServiceError extends Error {
  constructor(
    readonly code:
      | 'INVALID_MESSAGE'
      | 'ACTOR_NOT_AUTHORIZED'
      | 'NOT_PARTICIPANT'
      | 'CONVERSATION_NOT_FOUND'
      | 'SCOPE_NOT_FOUND'
      | 'SCOPE_CONVERSATION_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'MessageServiceError';
  }
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new MessageServiceError('INVALID_MESSAGE', `${label} is required.`);
  }
  return normalized;
}

function validateContent(command: SendMessageCommand): void {
  required(command.principalUserId, 'principalUserId');
  required(command.conversationId, 'conversationId');
  required(command.clientMessageId, 'clientMessageId');
  required(command.sender.actorId, 'sender.actorId');
  if (command.type === 'text' && !command.body?.trim()) {
    throw new MessageServiceError('INVALID_MESSAGE', 'Text message body is required.');
  }
  if (command.body !== undefined && command.body.length > 10_000) {
    throw new MessageServiceError('INVALID_MESSAGE', 'Message body is too long.');
  }
}

export class MessageService {
  constructor(
    private readonly persistence: MessagePersistencePort,
    private readonly actorAuthorization: MessageActorAuthorizationPort,
    private readonly runtime: MessageServiceRuntime,
  ) {}

  private async assertActorAuthority(
    principalUserId: string,
    actor: ActorRef,
  ): Promise<void> {
    if (selfAuthorizesUserActor(principalUserId, actor)) return;

    if (
      actor.actorType === 'user' ||
      actor.principalUserId !== principalUserId
    ) {
      throw new MessageServiceError(
        'ACTOR_NOT_AUTHORIZED',
        'Authenticated principal cannot act as requested sender.',
      );
    }

    const allowed = await this.actorAuthorization.canActAs({
      principalUserId,
      actor,
    });
    if (!allowed) {
      throw new MessageServiceError(
        'ACTOR_NOT_AUTHORIZED',
        'Authenticated principal cannot act as requested sender.',
      );
    }
  }

  async send(command: SendMessageCommand): Promise<SendMessageResult> {
    validateContent(command);
    await this.assertActorAuthority(command.principalUserId, command.sender);

    return this.persistence.transaction(async (tx) => {
      const conversation = await tx.lockConversation(command.conversationId);
      if (!conversation) {
        throw new MessageServiceError(
          'CONVERSATION_NOT_FOUND',
          'Conversation does not exist.',
        );
      }

      const participant = await tx.findParticipant({
        conversationId: command.conversationId,
        actor: command.sender,
      });
      if (!participant || participant.leftAt !== undefined) {
        throw new MessageServiceError(
          'NOT_PARTICIPANT',
          'Sender is not an active conversation participant.',
        );
      }

      if (command.scopeId !== undefined) {
        const scope = await tx.findScope(command.scopeId);
        if (!scope) {
          throw new MessageServiceError('SCOPE_NOT_FOUND', 'Scope does not exist.');
        }
        if (scope.conversationId !== command.conversationId) {
          throw new MessageServiceError(
            'SCOPE_CONVERSATION_MISMATCH',
            'Scope belongs to a different conversation.',
          );
        }
        if (scope.state === 'archived') {
          throw new MessageServiceError('SCOPE_NOT_FOUND', 'Scope is archived.');
        }
      }

      const existing = await tx.findMessageByIdempotency({
        conversationId: command.conversationId,
        sender: command.sender,
        clientMessageId: command.clientMessageId,
      });
      if (existing) {
        return { message: existing, replayed: true };
      }

      const sequence = conversation.lastSequence + 1;
      const message: Message = {
        messageId: this.runtime.nextMessageId(),
        conversationId: command.conversationId,
        ...(command.scopeId !== undefined ? { scopeId: command.scopeId } : {}),
        clientMessageId: command.clientMessageId,
        sender: command.sender,
        sequence,
        type: command.type,
        ...(command.body !== undefined ? { body: command.body } : {}),
        ...(command.replyToMessageId !== undefined
          ? { replyToMessageId: command.replyToMessageId }
          : {}),
        ...(command.actionRef !== undefined ? { actionRef: command.actionRef } : {}),
        createdAt: command.createdAt,
      };
      const outboxEvent: OutboxEvent = {
        outboxEventId: this.runtime.nextOutboxEventId(),
        aggregateType: 'message',
        aggregateId: message.messageId,
        eventType: 'message.created',
        createdAt: command.createdAt,
      };

      await tx.insertMessage(message);
      await tx.updateConversationSequence({
        conversationId: command.conversationId,
        lastSequence: sequence,
        lastActivityAt: command.createdAt,
      });
      await tx.insertOutbox(outboxEvent);

      return { message, outboxEvent, replayed: false };
    });
  }

  async listAfter(input: {
    principalUserId: string;
    conversationId: string;
    actor: ActorRef;
    afterSequence: number;
    limit?: number;
  }): Promise<Message[]> {
    await this.assertActorAuthority(input.principalUserId, input.actor);
    if (!Number.isInteger(input.afterSequence) || input.afterSequence < 0) {
      throw new MessageServiceError(
        'INVALID_MESSAGE',
        'afterSequence must be a non-negative integer.',
      );
    }
    const limit = Math.min(200, Math.max(1, input.limit ?? 50));

    await this.persistence.transaction(async (tx) => {
      const participant = await tx.findParticipant({
        conversationId: input.conversationId,
        actor: input.actor,
      });
      if (!participant || participant.leftAt !== undefined) {
        throw new MessageServiceError(
          'NOT_PARTICIPANT',
          'Actor is not an active conversation participant.',
        );
      }
    });

    return this.persistence.listAfter({
      conversationId: input.conversationId,
      afterSequence: input.afterSequence,
      limit,
    });
  }
}
