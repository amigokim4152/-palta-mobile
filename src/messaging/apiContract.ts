import type {
  ActionReference,
  ActorRef,
  Message,
  MessageAttachmentDraft,
  MessageType,
} from './contracts.js';
import type { SendMessageCommand } from './messageService.js';

export interface MessageApiActingActor {
  actor_type: ActorRef['actorType'];
  actor_id: string;
}

export interface MessageApiActionRef {
  resource_type: string;
  resource_id: string;
  action: string;
  contract_version: string;
}

export interface MessageApiAttachment {
  attachment_id?: string;
  asset_id: string;
  kind: MessageAttachmentDraft['kind'];
  mime_type: string;
  size_bytes?: number;
  duration_ms?: number;
}

export interface SendMessageApiRequest {
  client_message_id: string;
  scope_id?: string;
  acting_actor?: MessageApiActingActor;
  message_type: MessageType;
  body?: string;
  attachments?: MessageApiAttachment[];
  reply_to_message_id?: string;
  action_ref?: MessageApiActionRef;
}

export interface MessageApiResponse {
  message_id: string;
  conversation_id: string;
  scope_id?: string;
  client_message_id: string;
  sender: {
    actor_type: ActorRef['actorType'];
    actor_id: string;
  };
  sequence: number;
  message_type: MessageType;
  body?: string;
  attachments?: MessageApiAttachment[];
  reply_to_message_id?: string;
  action_ref?: MessageApiActionRef;
  created_at: string;
  replayed?: boolean;
}

export interface MessageListApiResponse {
  items: MessageApiResponse[];
  next_after_sequence: number;
  has_more: boolean;
}

export interface AdvanceReadApiRequest {
  acting_actor?: MessageApiActingActor;
  through_sequence: number;
}

function actionFromApi(input: MessageApiActionRef | undefined): ActionReference | undefined {
  if (!input) return undefined;
  return {
    resourceType: input.resource_type,
    resourceId: input.resource_id,
    action: input.action,
    contractVersion: input.contract_version,
  };
}

function attachmentFromApi(input: MessageApiAttachment): MessageAttachmentDraft {
  return {
    assetId: input.asset_id,
    kind: input.kind,
    mimeType: input.mime_type,
    ...(input.size_bytes !== undefined ? { sizeBytes: input.size_bytes } : {}),
    ...(input.duration_ms !== undefined ? { durationMs: input.duration_ms } : {}),
  };
}

/**
 * The authenticated principal is injected by the server. It is never accepted
 * from request JSON. `acting_actor` only asks to speak as a business/org/etc.;
 * MessageService still requires server-side actor authorization.
 */
export function sendCommandFromApi(input: {
  principalUserId: string;
  conversationId: string;
  request: SendMessageApiRequest;
  serverNow: string;
}): SendMessageCommand {
  const requestedActor = input.request.acting_actor;
  const sender: ActorRef = requestedActor
    ? requestedActor.actor_type === 'user'
      ? {
          actorType: 'user',
          actorId: requestedActor.actor_id,
        }
      : {
          actorType: requestedActor.actor_type,
          actorId: requestedActor.actor_id,
          principalUserId: input.principalUserId,
        }
    : {
        actorType: 'user',
        actorId: input.principalUserId,
      };
  const actionRef = actionFromApi(input.request.action_ref);
  const attachments = input.request.attachments?.map(attachmentFromApi);

  return {
    principalUserId: input.principalUserId,
    conversationId: input.conversationId,
    ...(input.request.scope_id !== undefined ? { scopeId: input.request.scope_id } : {}),
    clientMessageId: input.request.client_message_id,
    sender,
    type: input.request.message_type,
    ...(input.request.body !== undefined ? { body: input.request.body } : {}),
    ...(attachments !== undefined ? { attachments } : {}),
    ...(input.request.reply_to_message_id !== undefined
      ? { replyToMessageId: input.request.reply_to_message_id }
      : {}),
    ...(actionRef !== undefined ? { actionRef } : {}),
    createdAt: input.serverNow,
  };
}

export function messageToApi(
  message: Message,
  replayed?: boolean,
): MessageApiResponse {
  const actionRef = message.actionRef
    ? {
        resource_type: message.actionRef.resourceType,
        resource_id: message.actionRef.resourceId,
        action: message.actionRef.action,
        contract_version: message.actionRef.contractVersion,
      }
    : undefined;
  const attachments = message.attachments?.map((attachment) => ({
    attachment_id: attachment.attachmentId,
    asset_id: attachment.assetId,
    kind: attachment.kind,
    mime_type: attachment.mimeType,
    ...(attachment.sizeBytes !== undefined ? { size_bytes: attachment.sizeBytes } : {}),
    ...(attachment.durationMs !== undefined ? { duration_ms: attachment.durationMs } : {}),
  }));

  return {
    message_id: message.messageId,
    conversation_id: message.conversationId,
    ...(message.scopeId !== undefined ? { scope_id: message.scopeId } : {}),
    client_message_id: message.clientMessageId,
    sender: {
      actor_type: message.sender.actorType,
      actor_id: message.sender.actorId,
    },
    sequence: message.sequence,
    message_type: message.type,
    ...(message.body !== undefined ? { body: message.body } : {}),
    ...(attachments !== undefined && attachments.length > 0 ? { attachments } : {}),
    ...(message.replyToMessageId !== undefined
      ? { reply_to_message_id: message.replyToMessageId }
      : {}),
    ...(actionRef !== undefined ? { action_ref: actionRef } : {}),
    created_at: message.createdAt,
    ...(replayed !== undefined ? { replayed } : {}),
  };
}

export function buildMessageListResponse(input: {
  messages: Message[];
  requestedLimit: number;
}): MessageListApiResponse {
  const items = input.messages.map((message) => messageToApi(message));
  const last = input.messages.at(-1);
  return {
    items,
    next_after_sequence: last?.sequence ?? 0,
    has_more: input.messages.length >= input.requestedLimit,
  };
}
