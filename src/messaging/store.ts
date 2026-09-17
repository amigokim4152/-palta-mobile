import type { ActionReference, ActorRef, Message, MessageType, OutboxEvent } from './contracts.js';

export interface PersistMessageInput {
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

export interface PersistMessageResult {
  message: Message;
  outboxEvent: OutboxEvent;
  replayed: boolean;
}

export interface MessageStore {
  persistMessage(input: PersistMessageInput): Promise<PersistMessageResult>;
  listAfter(conversationId: string, afterSequence: number, limit: number): Promise<Message[]>;
}

export interface MessageStoreRuntime {
  nextMessageId(): string;
  nextOutboxEventId(): string;
}

export class InMemoryMessageStore implements MessageStore {
  private readonly messages = new Map<string, Message[]>();
  private readonly idempotency = new Map<string, PersistMessageResult>();

  constructor(private readonly runtime: MessageStoreRuntime) {}

  async persistMessage(input: PersistMessageInput): Promise<PersistMessageResult> {
    const idempotencyKey = `${input.conversationId}:${input.sender.actorType}:${input.sender.actorId}:${input.clientMessageId}`;
    const existing = this.idempotency.get(idempotencyKey);
    if (existing) return { ...existing, replayed: true };

    const conversationMessages = this.messages.get(input.conversationId) ?? [];
    const sequence = (conversationMessages.at(-1)?.sequence ?? 0) + 1;
    const message: Message = {
      messageId: this.runtime.nextMessageId(),
      conversationId: input.conversationId,
      ...(input.scopeId !== undefined ? { scopeId: input.scopeId } : {}),
      clientMessageId: input.clientMessageId,
      sender: input.sender,
      sequence,
      type: input.type,
      createdAt: input.createdAt,
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.replyToMessageId !== undefined ? { replyToMessageId: input.replyToMessageId } : {}),
      ...(input.actionRef !== undefined ? { actionRef: input.actionRef } : {}),
    };

    const outboxEvent: OutboxEvent = {
      outboxEventId: this.runtime.nextOutboxEventId(),
      aggregateType: 'message',
      aggregateId: message.messageId,
      eventType: 'message.created',
      createdAt: input.createdAt,
    };

    const persisted: PersistMessageResult = { message, outboxEvent, replayed: false };
    conversationMessages.push(message);
    this.messages.set(input.conversationId, conversationMessages);
    this.idempotency.set(idempotencyKey, persisted);
    return persisted;
  }

  async listAfter(conversationId: string, afterSequence: number, limit: number): Promise<Message[]> {
    if (!Number.isInteger(afterSequence) || afterSequence < 0) throw new Error('afterSequence must be a non-negative integer');
    if (!Number.isInteger(limit) || limit < 1) throw new Error('limit must be a positive integer');
    return (this.messages.get(conversationId) ?? [])
      .filter((message) => message.sequence > afterSequence)
      .slice(0, limit);
  }
}
