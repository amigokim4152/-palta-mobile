import type {
  BusinessFactCorrectionReason,
  BusinessFactCorrectionStatus,
} from '../business/businessFactCorrection.js';
import type { BusinessFactField } from '../business/businessFactEvidence.js';
import type { FetchLike } from './paltaApiClient.js';

export type BusinessCorrectionApiItem = {
  id: string;
  business_id: string;
  field: BusinessFactField;
  reason: BusinessFactCorrectionReason;
  status: BusinessFactCorrectionStatus;
  reported_at: string;
  note?: string;
  queue_target: 'owner_review' | 'trusted_review';
};

export type BusinessCorrectionsApiResponse = {
  business_id: string;
  items: BusinessCorrectionApiItem[];
};

export type SubmitBusinessCorrectionInput = {
  field: BusinessFactField;
  reason: BusinessFactCorrectionReason;
  note?: string;
};

export type ResolveBusinessCorrectionInput = {
  resolution: 'not_an_issue' | 'reviewed_and_addressed';
};

export type BusinessCorrectionsApiClientOptions = {
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

function validateCorrectionResult(
  value: unknown,
  label: string,
): BusinessCorrectionApiItem {
  const result = expectObject(value, label);
  if (
    typeof result.id !== 'string' ||
    typeof result.business_id !== 'string' ||
    typeof result.field !== 'string' ||
    typeof result.reason !== 'string' ||
    typeof result.status !== 'string' ||
    typeof result.reported_at !== 'string' ||
    typeof result.queue_target !== 'string'
  ) {
    throw new Error(`${label} returned invalid correction`);
  }
  return result as BusinessCorrectionApiItem;
}

export class BusinessCorrectionsApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: BusinessCorrectionsApiClientOptions) {
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
      throw new Error(`Palta business corrections API request failed: ${response.status}`);
    }
    return response.json();
  }

  async submitBusinessCorrection(
    businessId: string,
    input: SubmitBusinessCorrectionInput,
  ): Promise<BusinessCorrectionApiItem> {
    return validateCorrectionResult(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/corrections`, {
        method: 'POST',
        body: {
          field: input.field,
          reason: input.reason,
          ...(input.note?.trim() ? { note: input.note.trim() } : {}),
        },
      }),
      'POST /v1/business/{id}/corrections',
    );
  }

  async getOwnerBusinessCorrections(businessId: string): Promise<BusinessCorrectionsApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/owner-corrections`),
      'GET /v1/business/{id}/owner-corrections',
    );
    if (typeof result.business_id !== 'string' || !Array.isArray(result.items)) {
      throw new Error('GET /v1/business/{id}/owner-corrections returned invalid corrections');
    }
    return result as BusinessCorrectionsApiResponse;
  }

  async resolveOwnerBusinessCorrection(
    businessId: string,
    correctionId: string,
    input: ResolveBusinessCorrectionInput,
  ): Promise<BusinessCorrectionApiItem> {
    return validateCorrectionResult(
      await this.request(
        `/v1/business/${encodeURIComponent(businessId)}/owner-corrections/${encodeURIComponent(correctionId)}`,
        {
          method: 'PUT',
          body: { resolution: input.resolution },
        },
      ),
      'PUT /v1/business/{id}/owner-corrections/{correctionId}',
    );
  }
}
