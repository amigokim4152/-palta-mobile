import type { ActorRef, Conversation } from './contracts.js';
import type {
  ConversationInboxCursor,
  ConversationInboxItem,
} from './conversationDirectoryPort.js';

export interface ConversationApiActingActor {
  actor_type: ActorRef['actorType'];
  actor_id: string;
}

export interface ConversationApiResponse {
  conversation_id: string;
  conversation_type: Conversation['type'];
  last_sequence: number;
  last_activity_at: string;
  created_at: string;
  created?: boolean;
}

export interface ConversationInboxPreviewApi {
  message_id: string;
  sequence: number;
  message_type: string;
  body?: string;
  created_at: string;
}

export interface ConversationInboxItemApi {
  conversation: ConversationApiResponse;
  counterpart_actors: ConversationApiActingActor[];
  unread_count: number;
  last_message?: ConversationInboxPreviewApi;
}

export interface ConversationInboxApiResponse {
  items: ConversationInboxItemApi[];
  next_cursor?: {
    last_activity_at: string;
    conversation_id: string;
  };
}

/**
 * Authenticated principal is injected by the API server. acting_actor asks to
 * view a business/org/community Inbox, but never proves that authority.
 */
export function inboxActorFromApi(input: {
  principalUserId: string;
  actingActor?: ConversationApiActingActor;
}): ActorRef {
  const requested = input.actingActor;
  if (!requested) {
    return { actorType: 'user', actorId: input.principalUserId };
  }
  if (requested.actor_type === 'user') {
    return { actorType: 'user', actorId: requested.actor_id };
  }
  return {
    actorType: requested.actor_type,
    actorId: requested.actor_id,
    principalUserId: input.principalUserId,
  };
}

export function inboxCursorFromApi(input: {
  lastActivityAt?: string;
  conversationId?: string;
}): ConversationInboxCursor | undefined {
  if (input.lastActivityAt === undefined && input.conversationId === undefined) {
    return undefined;
  }
  if (!input.lastActivityAt || !input.conversationId) {
    throw new Error('Inbox cursor requires both last_activity_at and conversation_id.');
  }
  return {
    lastActivityAt: input.lastActivityAt,
    conversationId: input.conversationId,
  };
}

export function conversationToApi(
  conversation: Conversation,
  created?: boolean,
): ConversationApiResponse {
  return {
    conversation_id: conversation.conversationId,
    conversation_type: conversation.type,
    last_sequence: conversation.lastSequence,
    last_activity_at: conversation.lastActivityAt,
    created_at: conversation.createdAt,
    ...(created !== undefined ? { created } : {}),
  };
}

export function inboxItemToApi(
  item: ConversationInboxItem,
): ConversationInboxItemApi {
  const preview = item.lastMessage
    ? {
        message_id: item.lastMessage.messageId,
        sequence: item.lastMessage.sequence,
        message_type: item.lastMessage.type,
        ...(item.lastMessage.body !== undefined
          ? { body: item.lastMessage.body }
          : {}),
        created_at: item.lastMessage.createdAt,
      }
    : undefined;
  return {
    conversation: conversationToApi(item.conversation),
    counterpart_actors: item.counterpartActors.map((actor) => ({
      actor_type: actor.actorType,
      actor_id: actor.actorId,
    })),
    unread_count: Math.max(0, item.unreadCount),
    ...(preview !== undefined ? { last_message: preview } : {}),
  };
}

export function buildConversationInboxApiResponse(input: {
  items: ConversationInboxItem[];
  requestedLimit: number;
}): ConversationInboxApiResponse {
  const items = input.items.map(inboxItemToApi);
  const last = input.items.at(-1);
  const hasPossibleNextPage = input.items.length >= input.requestedLimit;
  return {
    items,
    ...(last && hasPossibleNextPage
      ? {
          next_cursor: {
            last_activity_at: last.conversation.lastActivityAt,
            conversation_id: last.conversation.conversationId,
          },
        }
      : {}),
  };
}
