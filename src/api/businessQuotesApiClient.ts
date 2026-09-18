import type { FetchLike } from './paltaApiClient.js';

export type BusinessQuoteApiStatus =
  | 'collecting'
  | 'responses_ready'
  | 'selected'
  | 'completed'
  | 'cancelled';

export type BusinessQuoteApiResponseItem = {
  id: string;
  business_id: string;
  business_name: string;
  amount_clp?: number;
  note?: string;
  available_at?: string;
  valid_until?: string;
  selected: boolean;
};

export type BusinessQuoteApiDetail = {
  id: string;
  care_track_id: string;
  description: string;
  recipient_business_ids: string[];
  status: BusinessQuoteApiStatus;
  created_at: string;
  requested_for?: string;
  selected_business_id?: string;
  responses: BusinessQuoteApiResponseItem[];
};

export type BusinessQuoteInboxOwnResponse = {
  id: string;
  amount_clp?: number;
  note?: string;
  available_at?: string;
  valid_until?: string;
};

/**
 * Business-scoped projection for owner CRM/inbox surfaces.
 * It intentionally omits recipient lists and every other business response.
 */
export type BusinessQuoteInboxItem = {
  id: string;
  care_track_id: string;
  description: string;
  status: BusinessQuoteApiStatus;
  created_at: string;
  requested_for?: string;
  response?: BusinessQuoteInboxOwnResponse;
  selected: boolean;
  can_respond: boolean;
};

export type BusinessQuoteInboxApiResponse = {
  business_id: string;
  items: BusinessQuoteInboxItem[];
};

export type CreateBusinessQuoteInput = {
  description: string;
  recipientBusinessIds: readonly string[];
  requestedFor?: string;
  serviceTaxonomyIds?: readonly string[];
  serviceAreaId?: string;
  mediaRefs?: readonly string[];
  idempotencyKey?: string;
};

export type SubmitBusinessQuoteResponseInput = {
  amountClp?: number;
  note?: string;
  availableAt?: string;
  validUntil?: string;
};

export type BusinessQuotesApiClientOptions = {
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

function validateQuoteDetail(value: unknown, label: string): BusinessQuoteApiDetail {
  const result = expectObject(value, label);
  if (
    typeof result.id !== 'string' ||
    typeof result.care_track_id !== 'string' ||
    typeof result.description !== 'string' ||
    !Array.isArray(result.recipient_business_ids) ||
    typeof result.status !== 'string' ||
    typeof result.created_at !== 'string' ||
    !Array.isArray(result.responses)
  ) {
    throw new Error(`${label} returned invalid quote`);
  }
  for (const item of result.responses as unknown[]) {
    const response = expectObject(item, `${label} response`);
    if (
      typeof response.id !== 'string' ||
      typeof response.business_id !== 'string' ||
      typeof response.business_name !== 'string' ||
      typeof response.selected !== 'boolean'
    ) {
      throw new Error(`${label} returned invalid quote response`);
    }
  }
  return result as BusinessQuoteApiDetail;
}

function validateBusinessInbox(value: unknown, label: string): BusinessQuoteInboxApiResponse {
  const result = expectObject(value, label);
  if (typeof result.business_id !== 'string' || !Array.isArray(result.items)) {
    throw new Error(`${label} returned invalid business quote inbox`);
  }
  for (const item of result.items as unknown[]) {
    const row = expectObject(item, `${label} item`);
    if (
      typeof row.id !== 'string' ||
      typeof row.care_track_id !== 'string' ||
      typeof row.description !== 'string' ||
      typeof row.status !== 'string' ||
      typeof row.created_at !== 'string' ||
      typeof row.selected !== 'boolean' ||
      typeof row.can_respond !== 'boolean'
    ) {
      throw new Error(`${label} returned invalid business quote inbox item`);
    }
    if ('recipient_business_ids' in row || 'responses' in row || 'selected_business_id' in row) {
      throw new Error(`${label} leaked cross-business quote data`);
    }
    if (row.response !== undefined) {
      const response = expectObject(row.response, `${label} item response`);
      if (typeof response.id !== 'string') {
        throw new Error(`${label} returned invalid own quote response`);
      }
      if ('business_id' in response || 'business_name' in response || 'selected' in response) {
        throw new Error(`${label} own response must stay business-local`);
      }
    }
  }
  return result as BusinessQuoteInboxApiResponse;
}

export class BusinessQuotesApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: BusinessQuotesApiClientOptions) {
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
      throw new Error(`Palta business quotes API request failed: ${response.status}`);
    }
    return response.json();
  }

  async createQuoteRequest(input: CreateBusinessQuoteInput): Promise<BusinessQuoteApiDetail> {
    return validateQuoteDetail(
      await this.request('/v1/local-business/quotes', {
        method: 'POST',
        ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
        body: {
          description: input.description.trim(),
          recipient_business_ids: [...input.recipientBusinessIds],
          service_taxonomy_ids: [...(input.serviceTaxonomyIds ?? [])],
          ...(input.requestedFor ? { requested_for: input.requestedFor } : {}),
          ...(input.serviceAreaId ? { service_area_id: input.serviceAreaId } : {}),
          ...(input.mediaRefs?.length ? { media_refs: [...input.mediaRefs] } : {}),
        },
      }),
      'POST /v1/local-business/quotes',
    );
  }

  async getBusinessInbox(businessId: string): Promise<BusinessQuoteInboxApiResponse> {
    return validateBusinessInbox(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/quote-requests`),
      'GET /v1/business/{businessId}/quote-requests',
    );
  }

  async getQuoteByCareTrack(careTrackId: string): Promise<BusinessQuoteApiDetail | null> {
    const response = await this.fetchImpl(
      joinUrl(this.baseUrl, `/v1/local-business/quotes/by-care/${encodeURIComponent(careTrackId)}`),
      { headers: await this.headers() },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Palta business quotes API request failed: ${response.status}`);
    return validateQuoteDetail(await response.json(), 'GET /v1/local-business/quotes/by-care/{careTrackId}');
  }

  async submitBusinessResponse(
    quoteRequestId: string,
    businessId: string,
    input: SubmitBusinessQuoteResponseInput,
  ): Promise<BusinessQuoteApiDetail> {
    return validateQuoteDetail(
      await this.request(
        `/v1/local-business/quotes/${encodeURIComponent(quoteRequestId)}/responses/${encodeURIComponent(businessId)}`,
        {
          method: 'PUT',
          body: {
            ...(input.amountClp !== undefined ? { amount_clp: input.amountClp } : {}),
            ...(input.note?.trim() ? { note: input.note.trim() } : {}),
            ...(input.availableAt ? { available_at: input.availableAt } : {}),
            ...(input.validUntil ? { valid_until: input.validUntil } : {}),
          },
        },
      ),
      'PUT /v1/local-business/quotes/{id}/responses/{businessId}',
    );
  }

  async selectBusiness(
    quoteRequestId: string,
    businessId: string,
  ): Promise<BusinessQuoteApiDetail> {
    return validateQuoteDetail(
      await this.request(`/v1/local-business/quotes/${encodeURIComponent(quoteRequestId)}/select`, {
        method: 'PUT',
        body: { business_id: businessId },
      }),
      'PUT /v1/local-business/quotes/{id}/select',
    );
  }
}