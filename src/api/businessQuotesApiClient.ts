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

export class BusinessQuotesApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: BusinessQuotesApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  private async request(
    path: string,
    init?: { method?: string; body?: unknown; idempotencyKey?: string },
  ): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
    if (init?.idempotencyKey) headers['Idempotency-Key'] = init.idempotencyKey;
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
        idempotencyKey: input.idempotencyKey,
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

  async getQuoteByCareTrack(careTrackId: string): Promise<BusinessQuoteApiDetail | null> {
    const response = await this.fetchImpl(
      joinUrl(this.baseUrl, `/v1/local-business/quotes/by-care/${encodeURIComponent(careTrackId)}`),
      { headers: { Accept: 'application/json' } },
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
