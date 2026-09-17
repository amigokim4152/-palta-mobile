export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export type HomeApiItem = {
  id: string;
  kind: 'action' | 'status' | 'alert' | 'useful_today' | 'content';
  title: string;
  body?: string;
  source_domain: string;
  delivery: 'home' | 'home_notify' | 'urgent';
  care_track_id?: string;
  related_entity_id?: string;
};

export type HomeApiResponse = {
  generated_at?: string;
  items: HomeApiItem[];
};

export type LocalSearchItem = {
  entity_id: string;
  entity_type: 'place' | 'business' | 'public_service' | 'event';
  name: string;
  category_key?: string;
  distance_m?: number;
  verification_status?: string;
  location: { lat: number; lng: number };
};

export type BusinessApiDetail = {
  id: string;
  name: string;
  category_key?: string;
  verification_status: 'unverified' | 'claimed' | 'verified' | 'suspended';
  opening_status?: string;
  location?: { lat: number; lng: number };
  contact?: {
    phone?: string;
    whatsapp?: string;
  };
};

export type CareApiTrack = {
  id: string;
  intent_key: string;
  state:
    | 'discover'
    | 'prepare'
    | 'act'
    | 'wait'
    | 'result'
    | 'follow_up'
    | 'outcome'
    | 'cancelled';
  waiting_for?: string;
  expected_at?: string;
};

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
  message_type: 'text' | 'voice' | 'image' | 'file' | 'location' | 'resource_card' | 'action_card';
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

export type MessageReadApiResponse = {
  conversation_id: string;
  last_delivered_sequence: number;
  last_read_sequence: number;
};

export type PaltaApiClientOptions = {
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

export class PaltaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'PaltaApiError';
  }
}

export class PaltaApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: PaltaApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  private async request(
    path: string,
    init?: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    },
  ): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    };
    if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;

    const requestInit: {
      method?: string;
      headers: Record<string, string>;
      body?: string;
    } = { headers };

    if (init?.method) requestInit.method = init.method;
    if (init?.body !== undefined) requestInit.body = JSON.stringify(init.body);

    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), requestInit);

    if (!response.ok) {
      throw new PaltaApiError(
        `Palta API request failed: ${response.status}`,
        response.status,
      );
    }
    return response.json();
  }

  async getHome(locale = 'es-CL'): Promise<HomeApiResponse> {
    const payload = expectObject(
      await this.request(`/v1/home?locale=${encodeURIComponent(locale)}`),
      'GET /v1/home',
    );
    if (!Array.isArray(payload.items)) {
      throw new Error('GET /v1/home payload missing items[]');
    }
    return payload as HomeApiResponse;
  }

  async searchLocal(input: {
    latitude: number;
    longitude: number;
    radiusM?: number;
    query?: string;
  }): Promise<LocalSearchItem[]> {
    const params = new URLSearchParams({
      lat: String(input.latitude),
      lng: String(input.longitude),
      radius_m: String(input.radiusM ?? 5000),
    });
    if (input.query) params.set('q', input.query);

    const payload = expectObject(
      await this.request(`/v1/local/search?${params.toString()}`),
      'GET /v1/local/search',
    );
    if (!Array.isArray(payload.items)) {
      throw new Error('GET /v1/local/search payload missing items[]');
    }
    return payload.items as LocalSearchItem[];
  }

  async getBusiness(businessId: string): Promise<BusinessApiDetail> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}`),
      'GET /v1/business/{id}',
    );
    if (typeof result.id !== 'string' || typeof result.name !== 'string') {
      throw new Error('GET /v1/business/{id} returned invalid business');
    }
    return result as BusinessApiDetail;
  }

  async getCare(careTrackId: string): Promise<CareApiTrack> {
    const result = expectObject(
      await this.request(`/v1/care/${encodeURIComponent(careTrackId)}`),
      'GET /v1/care/{id}',
    );
    if (
      typeof result.id !== 'string' ||
      typeof result.intent_key !== 'string' ||
      typeof result.state !== 'string'
    ) {
      throw new Error('GET /v1/care/{id} returned invalid Care track');
    }
    return result as CareApiTrack;
  }

  async createCare(input: {
    intentKey: string;
    subjectEntityId?: string;
    actionType?: string;
    payload?: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<CareApiTrack> {
    const body: Record<string, unknown> = {
      intent_key: input.intentKey,
      payload: input.payload ?? {},
    };
    if (input.subjectEntityId) body.subject_entity_id = input.subjectEntityId;
    if (input.actionType) body.action_type = input.actionType;

    const result = expectObject(
      await this.request('/v1/care', {
        method: 'POST',
        body,
        ...(input.idempotencyKey
          ? { headers: { 'Idempotency-Key': input.idempotencyKey } }
          : {}),
      }),
      'POST /v1/care',
    );

    if (typeof result.id !== 'string' || typeof result.state !== 'string') {
      throw new Error('POST /v1/care returned invalid Care track');
    }
    return result as CareApiTrack;
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
    const body: Record<string, unknown> = {
      through_sequence: input.throughSequence,
    };
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
