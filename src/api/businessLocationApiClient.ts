import type { FetchLike } from './paltaApiClient.js';

export type BusinessPublicLocationPrecisionApi = 'exact' | 'area_only' | 'hidden';

export type BusinessOwnerLocationApiResponse = {
  business_id: string;
  address_label?: string;
  anchor_point?: { latitude: number; longitude: number; accuracy_m?: number };
  public_precision: BusinessPublicLocationPrecisionApi;
  service_area_labels: string[];
  updated_at: string;
};

export type BusinessOwnerLocationUpdate = {
  addressLabel?: string;
  anchorPoint?: { latitude: number; longitude: number; accuracyM?: number };
  publicPrecision?: BusinessPublicLocationPrecisionApi;
  serviceAreaLabels?: readonly string[];
};

export type BusinessLocationApiClientOptions = {
  baseUrl: string;
  fetch: FetchLike;
  getAccessToken?: () => Promise<string | null>;
};

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function validateResult(value: unknown, label: string): BusinessOwnerLocationApiResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} returned a non-object payload`);
  }
  const result = value as Record<string, unknown>;
  if (
    typeof result.business_id !== 'string' ||
    (result.address_label !== undefined && typeof result.address_label !== 'string') ||
    (result.public_precision !== 'exact' && result.public_precision !== 'area_only' && result.public_precision !== 'hidden') ||
    !Array.isArray(result.service_area_labels) ||
    typeof result.updated_at !== 'string'
  ) {
    throw new Error(`${label} returned invalid owner location`);
  }
  if ((result.service_area_labels as unknown[]).some((item) => typeof item !== 'string')) {
    throw new Error(`${label} returned invalid service area label`);
  }
  if (result.anchor_point !== undefined) {
    if (!result.anchor_point || typeof result.anchor_point !== 'object' || Array.isArray(result.anchor_point)) {
      throw new Error(`${label} returned invalid anchor point`);
    }
    const point = result.anchor_point as Record<string, unknown>;
    if (typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
      throw new Error(`${label} returned invalid anchor point`);
    }
  }
  return result as BusinessOwnerLocationApiResponse;
}

export class BusinessLocationApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: BusinessLocationApiClientOptions) {
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
    if (!response.ok) throw new Error(`Palta business location API request failed: ${response.status}`);
    return response.json();
  }

  async getOwnerLocation(businessId: string): Promise<BusinessOwnerLocationApiResponse> {
    return validateResult(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/owner-location`),
      'GET /v1/business/{id}/owner-location',
    );
  }

  async updateOwnerLocation(
    businessId: string,
    update: BusinessOwnerLocationUpdate,
  ): Promise<BusinessOwnerLocationApiResponse> {
    const body: Record<string, unknown> = {};
    if (update.addressLabel !== undefined) body.address_label = update.addressLabel.trim();
    if (update.publicPrecision !== undefined) body.public_precision = update.publicPrecision;
    if (update.serviceAreaLabels !== undefined) body.service_area_labels = update.serviceAreaLabels.map((item) => item.trim()).filter(Boolean);
    if (update.anchorPoint !== undefined) {
      body.anchor_point = {
        latitude: update.anchorPoint.latitude,
        longitude: update.anchorPoint.longitude,
        ...(update.anchorPoint.accuracyM !== undefined ? { accuracy_m: update.anchorPoint.accuracyM } : {}),
      };
    }
    return validateResult(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/owner-location`, {
        method: 'PUT',
        body,
      }),
      'PUT /v1/business/{id}/owner-location',
    );
  }
}
