import type { FetchLike } from './paltaApiClient.js';

export type BusinessOwnerProfileApiResponse = {
  business_id: string;
  description?: string;
  contact: {
    phone?: string;
    whatsapp?: string;
  };
  updated_at: string;
};

export type BusinessOwnerProfileUpdate = {
  description?: string;
  phone?: string;
  whatsapp?: string;
};

export type BusinessOwnerProfileApiClientOptions = {
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

function validateResult(value: unknown, label: string): BusinessOwnerProfileApiResponse {
  const result = expectObject(value, label);
  if (
    typeof result.business_id !== 'string' ||
    !result.contact ||
    typeof result.contact !== 'object' ||
    typeof result.updated_at !== 'string'
  ) {
    throw new Error(`${label} returned invalid owner profile`);
  }
  return result as BusinessOwnerProfileApiResponse;
}

export class BusinessOwnerProfileApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: BusinessOwnerProfileApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  private async request(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = { Accept: 'application/json' };
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
      throw new Error(`Palta owner profile API request failed: ${response.status}`);
    }
    return response.json();
  }

  async getOwnerProfile(businessId: string): Promise<BusinessOwnerProfileApiResponse> {
    return validateResult(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/owner-profile`),
      'GET /v1/business/{id}/owner-profile',
    );
  }

  async updateOwnerProfile(
    businessId: string,
    input: BusinessOwnerProfileUpdate,
  ): Promise<BusinessOwnerProfileApiResponse> {
    const body: Record<string, string> = {};
    if (input.description !== undefined) body.description = input.description.trim();
    if (input.phone !== undefined) body.phone = input.phone.trim();
    if (input.whatsapp !== undefined) body.whatsapp = input.whatsapp.trim();

    return validateResult(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/owner-profile`, {
        method: 'PUT',
        body,
      }),
      'PUT /v1/business/{id}/owner-profile',
    );
  }
}
