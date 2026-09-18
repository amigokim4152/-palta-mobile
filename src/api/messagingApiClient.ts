import { PaltaApiError, type FetchLike } from './paltaApiClient.js';

export type MessageApiActor = {
  actor_type: 'user' | 'business' | 'organization' | 'community' | 'support';
  actor_id: string;
};

export type MessageApiActionRef = {
  resource_type: string;
  resource_id: string;
  action: string;
  contract_version: string;
};

export type MessageApiAttachment = {
  attachment_id?: string;
  asset_id: string;
  kind: 'image' | 'voice' | 'file';
  mime_type: string;
  size_bytes?: number;
  duration_ms?: number;
};

export type MessageApiItem = {
  message_id: string;
  conversation_id: string;
  scope_id?: string;
  client_message_id: string;
  sender: MessageApiActor;
  sequence: number;
  message_type:
    | 'text'
    | 'voice'
    | 'image'
    | 'file'
    | 'location'
    | 'resource_card'
    | 'action_card';
  body?: string;
  attachments?: MessageApiAttachment[];
  reply_to_message_id?: string;
  action_ref?: MessageApiActionRef;
  created_at: string;
  replayed?: boolean;
};

export type MessageListApiResponse = {
  items: MessageApiItem[];
  next_after_sequence: number;
  has_more: boolean;
};

export type DomainTimelineEventApiItem = {
  projection_id: string;
  conversation_id: string;
  scope_id: string;
  sequence: number;
  source_core: string;
  domain_event_id: string;
  event_type: string;
  resource_type: string;
  resource_id: string;
  occurred_at: string;
  projected_at: string;
};

export type ConversationTimelineApiItem =
  | { kind: 'message'; sequence: number; message: MessageApiItem }
  | { kind: 'domain_event'; sequence: number; event: DomainTimelineEventApiItem };

export type ConversationTimelineApiResponse = {
  items: ConversationTimelineApiItem[];
  next_after_sequence: number;
  has_more: boolean;
};

export type MessageReadApiResponse = {
  conversation_id: string;
  last_delivered_sequence: number;
  last_read_sequence: number;
};

export type ConversationApiItem = {
  conversation_id: string;
  conversation_type: 'direct' | 'business' | 'transaction' | 'group' | 'support';
  last_sequence: number;
  last_activity_at: string;
  created_at: string;
  created?: boolean;
};

export type ConversationInboxPreviewApi = {
  message_id: string;
  sequence: number;
  message_type: MessageApiItem['message_type'];
  body?: string;
  created_at: string;
};

export type ConversationInboxItemApi = {
  conversation: ConversationApiItem;
  counterpart_actors: MessageApiActor[];
  unread_count: number;
  last_message?: ConversationInboxPreviewApi;
};

export type ConversationInboxApiResponse = {
  items: ConversationInboxItemApi[];
  next_cursor?: {
    last_activity_at: string;
    conversation_id: string;
  };
};

export type MessagingApiClientOptions = {
  baseUrl: string;
  fetch: FetchLike;
  getAccessToken?: () => Promise<string | null>;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} returned a non-object payload`);
  }
  return value as Record<string, unknown>;
}

/**
 * Shared Messaging Core HTTP adapter. Local Business and other product surfaces
 * only navigate into Messaging; conversation identity, messages, read state and
 * authorization remain owned by the shared core.
 */
export class MessagingApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: MessagingApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  private async request(
    path: string,
    init?: { method?: string; body?: unknown; headers?: Record<string, string> },
  ): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    };
    if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const requestInit: { method?: string; headers: Record<string, string>; body?: string } = {
      headers,
    };
    if (init?.method) requestInit.method = init.method;
    if (init?.body !== undefined) requestInit.body = JSON.stringify(init.body);

    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), requestInit);
    if (!response.ok) {
      throw new PaltaApiError(`Palta Messaging API request failed: ${response.status}`, response.status);
    }
    return response.json();
  }

  async openBusinessConversation(businessId: string): Promise<ConversationApiItem> {
    const result = expectObject(
      await this.request(
        `/v1/messages/businesses/${encodeURIComponent(businessId)}/conversation`,
        { method: 'POST', body: {} },
      ),
      'POST /v1/messages/businesses/{businessId}/conversation',
    );
    if (
      typeof result.conversation_id !== 'string' ||
      typeof result.conversation_type !== 'string' ||
      typeof result.last_sequence !== 'number'
    ) {
      throw new Error('Open business conversation returned invalid payload');
    }
    return result as ConversationApiItem;
  }

  async listConversationInbox(input: {
    limit?: number;
    actingActor?: MessageApiActor;
    cursor?: { lastActivityAt: string; conversationId: string };
  } = {}): Promise<ConversationInboxApiResponse> {
    const params = new URLSearchParams({ limit: String(input.limit ?? 30) });
    if (input.actingActor) {
      params.set('acting_actor_type', input.actingActor.actor_type);
      params.set('acting_actor_id', input.actingActor.actor_id);
    }
    if (input.cursor) {
      params.set('after_activity', input.cursor.lastActivityAt);
      params.set('after_conversation_id', input.cursor.conversationId);
    }
    const result = expectObject(
      await this.request(`/v1/messages/conversations?${params.toString()}`),
      'GET /v1/messages/conversations',
    );
    if (!Array.isArray(result.items)) throw new Error('Conversation Inbox returned invalid payload');
    return result as ConversationInboxApiResponse;
  }

  async listMessages(input: {
    conversationId: string;
    afterSequence?: number;
    limit?: number;
    actingActor?: MessageApiActor;
  }): Promise<MessageListApiResponse> {
    const params = new URLSearchParams({
      after_sequence: String(input.afterSequence ?? 0),
      limit: String(input.limit ?? 50),
    });
    if (input.actingActor) {
      params.set('acting_actor_type', input.actingActor.actor_type);
      params.set('acting_actor_id', input.actingActor.actor_id);
    }
    const result = expectObject(
      await this.request(
        `/v1/messages/conversations/${encodeURIComponent(input.conversationId)}/messages?${params.toString()}`,
      ),
      'GET /v1/messages/conversations/{id}/messages',
    );
    if (!Array.isArray(result.items) || typeof result.next_after_sequence !== 'number') {
      throw new Error('Message list returned invalid payload');
    }
    return result as MessageListApiResponse;
  }

  async listConversationTimeline(input: {
    conversationId: string;
    afterSequence?: number;
    limit?: number;
    actingActor?: MessageApiActor;
  }): Promise<ConversationTimelineApiResponse> {
    const params = new URLSearchParams({
      after_sequence: String(input.afterSequence ?? 0),
      limit: String(input.limit ?? 50),
    });
    if (input.actingActor) {
      params.set('acting_actor_type', input.actingActor.actor_type);
      params.set('acting_actor_id', input.actingActor.actor_id);
    }
    const result = expectObject(
      await this.request(
        `/v1/messages/conversations/${encodeURIComponent(input.conversationId)}/timeline?${params.toString()}`,
      ),
      'GET /v1/messages/conversations/{id}/timeline',
    );
    if (
      !Array.isArray(result.items) ||
      typeof result.next_after_sequence !== 'number' ||
      typeof result.has_more !== 'boolean'
    ) {
      throw new Error('Conversation timeline returned invalid payload');
    }
    return result as ConversationTimelineApiResponse;
  }

  async sendMessage(input: {
    conversationId: string;
    clientMessageId: string;
    scopeId?: string;
    actingActor?: MessageApiActor;
    messageType: MessageApiItem['message_type'];
    body?: string;
    attachments?: MessageApiAttachment[];
    replyToMessageId?: string;
    actionRef?: MessageApiActionRef;
  }): Promise<MessageApiItem> {
    const body: Record<string, unknown> = {
      client_message_id: input.clientMessageId,
      message_type: input.messageType,
    };
    if (input.scopeId) body.scope_id = input.scopeId;
    if (input.actingActor) body.acting_actor = input.actingActor;
    if (input.body !== undefined) body.body = input.body;
    if (input.attachments !== undefined) body.attachments = input.attachments;
    if (input.replyToMessageId) body.reply_to_message_id = input.replyToMessageId;
    if (input.actionRef) body.action_ref = input.actionRef;

    const result = expectObject(
      await this.request(
        `/v1/messages/conversations/${encodeURIComponent(input.conversationId)}/messages`,
        {
          method: 'POST',
          body,
          headers: { 'Idempotency-Key': input.clientMessageId },
        },
      ),
      'POST /v1/messages/conversations/{id}/messages',
    );
    if (typeof result.message_id !== 'string' || typeof result.sequence !== 'number') {
      throw new Error('Send message returned invalid payload');
    }
    return result as MessageApiItem;
  }

  async advanceMessageRead(input: {
    conversationId: string;
    throughSequence: number;
    actingActor?: MessageApiActor;
  }): Promise<MessageReadApiResponse> {
    const body: Record<string, unknown> = { through_sequence: input.throughSequence };
    if (input.actingActor) body.acting_actor = input.actingActor;

    const result = expectObject(
      await this.request(
        `/v1/messages/conversations/${encodeURIComponent(input.conversationId)}/read`,
        { method: 'POST', body },
      ),
      'POST /v1/messages/conversations/{id}/read',
    );
    if (
      typeof result.conversation_id !== 'string' ||
      typeof result.last_read_sequence !== 'number'
    ) {
      throw new Error('Advance message read returned invalid payload');
    }
    return result as MessageReadApiResponse;
  }
}
