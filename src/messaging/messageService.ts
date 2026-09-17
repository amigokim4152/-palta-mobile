import type {
  MessageActorAuthorizationPort,
  MessageActorOperation,
} from './authorizationPort.js';
import { selfAuthorizesUserActor } from './authorizationPort.js';
import type { MessageAttachmentAuthorizationPort } from './attachmentAuthorizationPort.js';
import type {
  ActionReference,
  ActorRef,
  Message,
  MessageAttachment,
  MessageAttachmentDraft,
  MessageType,
  OutboxEvent,
  ParticipantState,
} from './contracts.js';
import type { MessagePersistencePort } from './persistencePort.js';

export interface MessageServiceRuntime {
  nextMessageId(): string;
  nextOutboxEventId(): string;
  nextAttachmentId?(): string;
}

export interface SendMessageCommand {
  principalUserId: string;
  conversationId: string;
  scopeId?: string;
  clientMessageId: string;
  sender: ActorRef;
  type: MessageType;
  body?: string;
  attachments?: MessageAttachmentDraft[];
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
      | 'INVALID_CURSOR'
      | 'ACTOR_NOT_AUTHORIZED'
      | 'ATTACHMENT_NOT_AUTHORIZED'
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

function validateAttachment(attachment: MessageAttachmentDraft): void {
  required(attachment.assetId, 'attachment.assetId');
  required(attachment.mimeType, 'attachment.mimeType');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(attachment.assetId)) {
    throw new MessageServiceError(
      'INVALID_MESSAGE',
      'Attachment assetId must be provider-neutral and must not be a URL.',
    );
  }
  if (
    attachment.sizeBytes !== undefined &&
    (!Number.isInteger(attachment.sizeBytes) || attachment.sizeBytes < 0)
  ) {
    throw new MessageServiceError(
      'INVALID_MESSAGE',
      'attachment.sizeBytes must be a non-negative integer.',
    );
  }
  if (
    attachment.durationMs !== undefined &&
    (!Number.isInteger(attachment.durationMs) || attachment.durationMs < 0)
  ) {
    throw new MessageServiceError(
      'INVALID_MESSAGE',
      'attachment.durationMs must be a non-negative integer.',
    );
  }
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

  const attachments = command.attachments ?? [];
  if (attachments.length > 10) {
    throw new MessageServiceError(
      'INVALID_MESSAGE',
      'A message cannot contain more than 10 attachments.',
    );
  }
  for (const attachment of attachments) validateAttachment(attachment);

  if (command.type === 'voice') {
    if (attachments.length !== 1 || attachments[0]?.kind !== 'voice') {
      throw new MessageServiceError(
        'INVALID_MESSAGE',
        'Voice message requires exactly one voice attachment.',
      );
    }
  } else if (command.type === 'image') {
    if (attachments.length < 1 || attachments.some((item) => item.kind !== 'image')) {
      throw new MessageServiceError(
        'INVALID_MESSAGE',
        'Image message requires image attachments only.',
      );
    }
  } else if (command.type === 'file') {
    if (attachments.length < 1 || attachments.some((item) => item.kind !== 'file')) {
      throw new MessageServiceError(
        'INVALID_MESSAGE',
        'File message requires file attachments only.',
      );
    }
  } else if (attachments.length > 0) {
    throw new MessageServiceError(
      'INVALID_MESSAGE',
      `Message type ${command.type} does not accept attachments.`,
    );
  }
}

export class MessageService {
  constructor(
    private readonly persistence: MessagePersistencePort,
    private readonly actorAuthorization: MessageActorAuthorizationPort,
    private readonly runtime: MessageServiceRuntime,
    private readonly attachmentAuthorization?: MessageAttachmentAuthorizationPort,
  ) {}

  private async assertActorAuthority(
    principalUserId: string,
    actor: ActorRef,
    operation: MessageActorOperation,
  ): Promise<void> {
    if (selfAuthorizesUserActor(principalUserId, actor)) return;

    if (
      actor.actorType === 'user' ||
      actor.principalUserId !== principalUserId
    ) {
      throw new MessageServiceError(
        'ACTOR_NOT_AUTHORIZED',
        'Authenticated principal cannot act as requested Message actor.',
      );
    }

    const allowed = await this.actorAuthorization.canActAs({
      principalUserId,
      actor,
      operation,
    });
    if (!allowed) {
      throw new MessageServiceError(
        'ACTOR_NOT_AUTHORIZED',
        `Authenticated principal cannot ${operation} as requested Message actor.`,
      );
    }
  }

  private async assertAttachmentAuthority(command: SendMessageCommand): Promise<void> {
    const attachments = command.attachments ?? [];
    if (attachments.length === 0) return;
    if (!this.attachmentAuthorization) {
      throw new MessageServiceError(
        'ATTACHMENT_NOT_AUTHORIZED',
        'Attachment authorization is not configured.',
      );
    }
    for (const attachment of attachments) {
      const allowed = await this.attachmentAuthorization.canAttach({
        principalUserId: command.principalUserId,
        actor: command.sender,
        attachment,
      });
      if (!allowed) {
        throw new MessageServiceError(
          'ATTACHMENT_NOT_AUTHORIZED',
          'Authenticated principal cannot attach the requested asset.',
        );
      }
    }
  }

  private buildAttachments(
    messageId: string,
    drafts: MessageAttachmentDraft[],
  ): MessageAttachment[] {
    if (drafts.length === 0) return [];
    if (!this.runtime.nextAttachmentId) {
      throw new MessageServiceError(
        'INVALID_MESSAGE',
        'Attachment ID runtime is not configured.',
      );
    }
    return drafts.map((draft) => ({
      attachmentId: this.runtime.nextAttachmentId!(),
      messageId,
      ...draft,
    }));
  }

  async send(command: SendMessageCommand): Promise<SendMessageResult> {
    validateContent(command);
    await this.assertActorAuthority(
      command.principalUserId,
      command.sender,
      'send',
    );
    await this.assertAttachmentAuthority(command);

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
      const messageId = this.runtime.nextMessageId();
      const attachments = this.buildAttachments(messageId, command.attachments ?? []);
      const message: Message = {
        messageId,
        conversationId: command.conversationId,
        ...(command.scopeId !== undefined ? { scopeId: command.scopeId } : {}),
        clientMessageId: command.clientMessageId,
        sender: command.sender,
        sequence,
        type: command.type,
        ...(command.body !== undefined ? { body: command.body } : {}),
        ...(attachments.length > 0 ? { attachments } : {}),
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
        payload: {
          conversationId: message.conversationId,
          ...(message.scopeId !== undefined ? { scopeId: message.scopeId } : {}),
          sequence: message.sequence,
          messageId: message.messageId,
        },
        createdAt: command.createdAt,
      };

      await tx.insertMessage(message);
      if (attachments.length > 0) await tx.insertAttachments(attachments);
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
    await this.assertActorAuthority(
      input.principalUserId,
      input.actor,
      'read',
    );
    if (!Number.isInteger(input.afterSequence) || input.afterSequence < 0) {
      throw new MessageServiceError(
        'INVALID_CURSOR',
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

  async advanceRead(input: {
    principalUserId: string;
    conversationId: string;
    actor: ActorRef;
    throughSequence: number;
    occurredAt: string;
  }): Promise<ParticipantState> {
    await this.assertActorAuthority(
      input.principalUserId,
      input.actor,
      'read',
    );
    if (!Number.isInteger(input.throughSequence) || input.throughSequence < 0) {
      throw new MessageServiceError(
        'INVALID_CURSOR',
        'throughSequence must be a non-negative integer.',
      );
    }

    return this.persistence.transaction(async (tx) => {
      const current = await tx.findParticipant({
        conversationId: input.conversationId,
        actor: input.actor,
      });
      if (!current || current.leftAt !== undefined) {
        throw new MessageServiceError(
          'NOT_PARTICIPANT',
          'Actor is not an active conversation participant.',
        );
      }

      const next = await tx.advanceRead({
        conversationId: input.conversationId,
        actor: input.actor,
        throughSequence: input.throughSequence,
      });
      if (!next) {
        throw new MessageServiceError(
          'NOT_PARTICIPANT',
          'Actor is not an active conversation participant.',
        );
      }

      if (next.lastReadSequence > current.lastReadSequence) {
        await tx.insertOutbox({
          outboxEventId: this.runtime.nextOutboxEventId(),
          aggregateType: 'conversation',
          aggregateId: input.conversationId,
          eventType: 'participant.read_advanced',
          payload: {
            conversationId: input.conversationId,
            actorType: input.actor.actorType,
            actorId: input.actor.actorId,
            throughSequence: next.lastReadSequence,
          },
          createdAt: input.occurredAt,
        });
      }

      return next;
    });
  }
}
