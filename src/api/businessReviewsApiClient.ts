import type { FetchLike } from './paltaApiClient.js';

export type PublicBusinessReviewApiItem = {
  id: string;
  author_label: string;
  rating: number;
  body?: string;
  verified_interaction: true;
  evidence_label: string;
  created_at: string;
  business_reply?: {
    body: string;
    replied_at: string;
  };
};

export type BusinessReviewSummaryApi = {
  count: number;
  average_rating?: number;
};

export type BusinessReviewsApiResponse = {
  business_id: string;
  summary: BusinessReviewSummaryApi;
  items: PublicBusinessReviewApiItem[];
};

export type BusinessReviewsApiClientOptions = {
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

export class BusinessReviewsApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: BusinessReviewsApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  async getBusinessReviews(businessId: string): Promise<BusinessReviewsApiResponse> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await this.fetchImpl(
      joinUrl(this.baseUrl, `/v1/business/${encodeURIComponent(businessId)}/reviews`),
      { headers },
    );
    if (!response.ok) {
      throw new Error(`Palta business reviews API request failed: ${response.status}`);
    }

    const result = expectObject(await response.json(), 'GET /v1/business/{id}/reviews');
    if (
      typeof result.business_id !== 'string' ||
      !result.summary ||
      typeof result.summary !== 'object' ||
      !Array.isArray(result.items)
    ) {
      throw new Error('GET /v1/business/{id}/reviews returned invalid reviews');
    }

    const summary = result.summary as Record<string, unknown>;
    if (typeof summary.count !== 'number') {
      throw new Error('GET /v1/business/{id}/reviews returned invalid summary');
    }

    for (const item of result.items as unknown[]) {
      const review = expectObject(item, 'GET /v1/business/{id}/reviews item');
      if (
        typeof review.id !== 'string' ||
        typeof review.author_label !== 'string' ||
        typeof review.rating !== 'number' ||
        review.verified_interaction !== true ||
        typeof review.evidence_label !== 'string' ||
        typeof review.created_at !== 'string'
      ) {
        throw new Error('GET /v1/business/{id}/reviews returned invalid review item');
      }
      if ('author_user_id' in review || 'authorUserId' in review) {
        throw new Error('GET /v1/business/{id}/reviews exposed canonical reviewer id');
      }
    }

    return result as BusinessReviewsApiResponse;
  }
}
