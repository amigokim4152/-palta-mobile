import type { FetchLike } from './paltaApiClient.js';

export type BusinessReservationApiStatus =
  | 'requested'
  | 'confirmed'
  | 'declined'
  | 'cancelled';

export type BusinessReservationApiDetail = {
  id: string;
  business_id: string;
  care_track_id: string;
  requested_for: string;
  status: BusinessReservationApiStatus;
  channel: 'whatsapp';
  created_at: string;
  updated_at: string;
  note?: string;
  owner_note?: string;
  responded_at?: string;
};

export type BusinessReservationInboxItem = BusinessReservationApiDetail & {
  can_respond: boolean;
};

export type BusinessReservationInboxApiResponse = {
  business_id: string;
  items: BusinessReservationInboxItem[];
};

export type CreateBusinessReservationInput = {
  businessId: string;
  requestedFor: string;
  note?: string;
  channel: 'whatsapp';
  messagingContextType: 'booking';
  messagingPurposeKey: string;
  idempotencyKey?: string;
};

export type RespondBusinessReservationInput = {
  decision: 'confirmed' | 'declined';
  note?: string;
};

export type BusinessReservationsApiClientOptions = {
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

function validateReservation(value: unknown, label: string): BusinessReservationApiDetail {
  const result = expectObject(value, label);
  if (
    typeof result.id !== 'string' ||
    typeof result.business_id !== 'string' ||
    typeof result.care_track_id !== 'string' ||
    typeof result.requested_for !== 'string' ||
    typeof result.status !== 'string' ||
    result.channel !== 'whatsapp' ||
    typeof result.created_at !== 'string' ||
    typeof result.updated_at !== 'string'
  ) {
    throw new Error(`${label} returned invalid reservation`);
  }
  return result as BusinessReservationApiDetail;
}

function validateBusinessInbox(value: unknown, label: string): BusinessReservationInboxApiResponse {
  const result = expectObject(value, label);
  if (typeof result.business_id !== 'string' || !Array.isArray(result.items)) {
    throw new Error(`${label} returned invalid reservation inbox`);
  }
  for (const item of result.items as unknown[]) {
    const row = validateReservation(item, `${label} item`) as BusinessReservationInboxItem;
    if (typeof row.can_respond !== 'boolean') {
      throw new Error(`${label} returned invalid reservation inbox item`);
    }
    const raw = item as Record<string, unknown>;
    if ('requester_user_id' in raw || 'requester_email' in raw || 'requester_phone' in raw) {
      throw new Error(`${label} leaked requester identity`);
    }
  }
  return result as BusinessReservationInboxApiResponse;
}

export class BusinessReservationsApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: BusinessReservationsApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  private async headers(input?: { hasBody?: boolean; idempotencyKey?: string }): Promise<Record<string, string>> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (input?.hasBody) headers['Content-Type'] = 'application/json';
    if (input?.idempotencyKey) headers['Idempotency-Key'] = input.idempotencyKey;
    return headers;
  }

  private async request(
    path: string,
    init?: { method?: string; body?: unknown; idempotencyKey?: string },
  ): Promise<unknown> {
    const headers = await this.headers({
      hasBody: init?.body !== undefined,
      ...(init?.idempotencyKey ? { idempotencyKey: init.idempotencyKey } : {}),
    });
    const requestInit: { method?: string; headers: Record<string, string>; body?: string } = { headers };
    if (init?.method) requestInit.method = init.method;
    if (init?.body !== undefined) requestInit.body = JSON.stringify(init.body);
    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), requestInit);
    if (!response.ok) {
      throw new Error(`Palta business reservations API request failed: ${response.status}`);
    }
    return response.json();
  }

  async createReservation(input: CreateBusinessReservationInput): Promise<BusinessReservationApiDetail> {
    return validateReservation(
      await this.request('/v1/local-business/reservations', {
        method: 'POST',
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        body: {
          business_id: input.businessId,
          requested_for: input.requestedFor,
          channel: input.channel,
          messaging_context_type: input.messagingContextType,
          messaging_purpose_key: input.messagingPurposeKey,
          ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        },
      }),
      'POST /v1/local-business/reservations',
    );
  }

  async getByCareTrack(careTrackId: string): Promise<BusinessReservationApiDetail | null> {
    const response = await this.fetchImpl(
      joinUrl(this.baseUrl, `/v1/local-business/reservations/by-care/${encodeURIComponent(careTrackId)}`),
      { headers: await this.headers() },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Palta business reservations API request failed: ${response.status}`);
    return validateReservation(
      await response.json(),
      'GET /v1/local-business/reservations/by-care/{careTrackId}',
    );
  }

  async getBusinessInbox(businessId: string): Promise<BusinessReservationInboxApiResponse> {
    return validateBusinessInbox(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/reservations`),
      'GET /v1/business/{businessId}/reservations',
    );
  }

  async respond(
    reservationId: string,
    businessId: string,
    input: RespondBusinessReservationInput,
  ): Promise<BusinessReservationApiDetail> {
    return validateReservation(
      await this.request(`/v1/local-business/reservations/${encodeURIComponent(reservationId)}/decision`, {
        method: 'PUT',
        body: {
          business_id: businessId,
          decision: input.decision,
          ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        },
      }),
      'PUT /v1/local-business/reservations/{id}/decision',
    );
  }
}
