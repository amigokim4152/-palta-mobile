import type {
  ActorRef,
  ConversationScope,
  Message,
  MessageAttachment,
  OutboxEvent,
  ParticipantState,
} from './contracts.js';

export interface LockedConversationState {
  conversationId: string;
  lastSequence: number;
  lastActivityAt: string;
}

export interface MessagePersistenceTransaction {
  findMessageByIdempotency(input: {
    conversationId: string;
    sender: ActorRef;
    clientMessageId: string;
  }): Promise<Message | null>;

  lockConversation(conversationId: string): Promise<LockedConversationState | null>;

  findParticipant(input: {
    conversationId: string;
    actor: ActorRef;
  }): Promise<ParticipantState | null>;

  findScope(scopeId: string): Promise<ConversationScope | null>;

  insertMessage(message: Message): Promise<void>;

  insertAttachments(attachments: MessageAttachment[]): Promise<void>;

  updateConversationSequence(input: {
    conversationId: string;
    lastSequence: number;
    lastActivityAt: string;
  }): Promise<void>;

  advanceRead(input: {
    conversationId: string;
    actor: ActorRef;
    throughSequence: number;
  }): Promise<ParticipantState | null>;

  insertOutbox(event: OutboxEvent): Promise<void>;
}

export interface MessagePersistencePort {
  transaction<T>(
    run: (tx: MessagePersistenceTransaction) => Promise<T>,
  ): Promise<T>;

  listAfter(input: {
    conversationId: string;
    afterSequence: number;
    limit: number;
  }): Promise<Message[]>;
}
