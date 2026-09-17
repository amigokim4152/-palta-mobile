import type { FetchLike } from './paltaApiClient.js';

export type BusinessOwnerServiceApiItem = {
  service_id: string;
  label: string;
  discovery_group_key: string;
};

export type BusinessOwnerServicesApiResponse = {
  business_id: string;
  items: BusinessOwnerServiceApiItem[];
  pending_owner_phrases: string[];
  updated_at: string;
};

export type BusinessOwnerServicesUpdate = {
  canonicalServiceIds: readonly string[];
  pendingOwnerPhrases?: readonly string[];
};

export type BusinessServicesApiClientOptions = {
  baseUrl: string;
  fetch: FetchLike;
  getAccessToken?: () => Promise<string | null>;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function validateResult(value: unknown, label: string): BusinessOwnerServicesApiResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} returned a non-object payload`);
  }
  const result = value as Record<string, unknown>;
  if (
    typeof result.business_id !== 'string' ||
    !Array.isArray(result.items) ||
    !Array.isArray(result.pending_owner_phrases) ||
    typeof result.updated_at !== 'string'
  ) {
    throw new Error(`${label} returned invalid owner services`);
  }
  for (const raw of result.items) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`${label} returned invalid service item`);
    }
    const item = raw as Record<string, unknown>;
    if (
      typeof item.service_id !== 'string' ||
      typeof item.label !== 'string' ||
      typeof item.discovery_group_key !== 'string'
    ) {
      throw new Error(`${label} returned invalid service item`);
    }
  }
  if ((result.pending_owner_phrases as unknown[]).some((item) => typeof item !== 'string')) {
    throw new Error(`${label} returned invalid pending owner phrase`);
  }
  return result as BusinessOwnerServicesApiResponse;
}

export class BusinessServicesApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: BusinessServicesApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  private async request(path: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const requestInit: { method?: string; headers: Record<string, string>; body?: string } = { headers };
    if (init?.method) requestInit.method = init.method;
    if (init?.body !== undefined) requestInit.body = JSON.stringify(init.body);
    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), requestInit);
    if (!response.ok) throw new Error(`Palta business services API request failed: ${response.status}`);
    return response.json();
  }

  async getOwnerServices(businessId: string): Promise<BusinessOwnerServicesApiResponse> {
    return validateResult(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/owner-services`),
      'GET /v1/business/{id}/owner-services',
    );
  }

  async updateOwnerServices(
    businessId: string,
    update: BusinessOwnerServicesUpdate,
  ): Promise<BusinessOwnerServicesApiResponse> {
    return validateResult(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/owner-services`, {
        method: 'PUT',
        body: {
          canonical_service_ids: [...update.canonicalServiceIds],
          pending_owner_phrases: [...(update.pendingOwnerPhrases ?? [])],
        },
      }),
      'PUT /v1/business/{id}/owner-services',
    );
  }
}
