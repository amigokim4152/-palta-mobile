import type {
  ActorRef,
  Conversation,
  ConversationType,
  MessageType,
  ParticipantRole,
} from './contracts.js';

export interface ConversationPairParticipant {
  actor: ActorRef;
  role: ParticipantRole;
}

export interface EnsureOneToOneConversationInput {
  conversationId: string;
  type: ConversationType;
  first: ConversationPairParticipant;
  second: ConversationPairParticipant;
  createdAt: string;
}

export interface EnsureOneToOneConversationResult {
  conversation: Conversation;
  created: boolean;
}

export interface InboxMessagePreview {
  messageId: string;
  sequence: number;
  type: MessageType;
  body?: string;
  createdAt: string;
}

export interface ConversationInboxItem {
  conversation: Conversation;
  counterpartActors: ActorRef[];
  unreadCount: number;
  lastMessage?: InboxMessagePreview;
}

export interface ConversationInboxCursor {
  lastActivityAt: string;
  conversationId: string;
}

export interface ConversationDirectoryPort {
  ensureOneToOne(
    input: EnsureOneToOneConversationInput,
  ): Promise<EnsureOneToOneConversationResult>;

  listForActor(input: {
    actor: ActorRef;
    cursor?: ConversationInboxCursor;
    limit: number;
  }): Promise<ConversationInboxItem[]>;
}
