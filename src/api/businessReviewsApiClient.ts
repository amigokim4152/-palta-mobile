import type { BusinessReviewEvidenceKind } from '../business/businessReview.js';
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

export type BusinessReviewEligibilityApiResponse =
  | {
      business_id: string;
      eligible: true;
      evidence: {
        kind: BusinessReviewEvidenceKind;
        reference_id: string;
        label: string;
      };
      completed_at: string;
    }
  | {
      business_id: string;
      eligible: false;
      reason: 'no_verified_interaction' | 'already_reviewed';
      existing_review_id?: string;
    };

export type CreateBusinessReviewInput = {
  rating: number;
  body?: string;
  evidenceKind: BusinessReviewEvidenceKind;
  evidenceReferenceId: string;
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

function validatePublicReviewItem(item: unknown, label: string): PublicBusinessReviewApiItem {
  const review = expectObject(item, label);
  if (
    typeof review.id !== 'string' ||
    typeof review.author_label !== 'string' ||
    typeof review.rating !== 'number' ||
    review.verified_interaction !== true ||
    typeof review.evidence_label !== 'string' ||
    typeof review.created_at !== 'string'
  ) {
    throw new Error(`${label} returned invalid review item`);
  }
  if ('author_user_id' in review || 'authorUserId' in review) {
    throw new Error(`${label} exposed canonical reviewer id`);
  }
  return review as PublicBusinessReviewApiItem;
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

  private async request(
    path: string,
    init?: { method?: string; body?: unknown },
  ): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
    const requestInit: {
      method?: string;
      headers: Record<string, string>;
      body?: string;
    } = { headers };
    if (init?.method) requestInit.method = init.method;
    if (init?.body !== undefined) requestInit.body = JSON.stringify(init.body);

    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), requestInit);
    if (!response.ok) {
      throw new Error(`Palta business reviews API request failed: ${response.status}`);
    }
    return response.json();
  }

  async getBusinessReviews(businessId: string): Promise<BusinessReviewsApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/reviews`),
      'GET /v1/business/{id}/reviews',
    );
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
      validatePublicReviewItem(item, 'GET /v1/business/{id}/reviews item');
    }

    return result as BusinessReviewsApiResponse;
  }

  async getMyReviewEligibility(businessId: string): Promise<BusinessReviewEligibilityApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/my-review-eligibility`),
      'GET /v1/business/{id}/my-review-eligibility',
    );
    if (typeof result.business_id !== 'string' || typeof result.eligible !== 'boolean') {
      throw new Error('GET /v1/business/{id}/my-review-eligibility returned invalid eligibility');
    }
    if (result.eligible === true) {
      const evidence = expectObject(
        result.evidence,
        'GET /v1/business/{id}/my-review-eligibility evidence',
      );
      if (
        typeof evidence.kind !== 'string' ||
        typeof evidence.reference_id !== 'string' ||
        typeof evidence.label !== 'string' ||
        typeof result.completed_at !== 'string'
      ) {
        throw new Error('GET /v1/business/{id}/my-review-eligibility returned invalid verified interaction');
      }
    } else if (
      result.reason !== 'no_verified_interaction' &&
      result.reason !== 'already_reviewed'
    ) {
      throw new Error('GET /v1/business/{id}/my-review-eligibility returned invalid reason');
    }
    return result as BusinessReviewEligibilityApiResponse;
  }

  async createBusinessReview(
    businessId: string,
    input: CreateBusinessReviewInput,
  ): Promise<PublicBusinessReviewApiItem> {
    return validatePublicReviewItem(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/reviews`, {
        method: 'POST',
        body: {
          rating: input.rating,
          ...(input.body?.trim() ? { body: input.body.trim() } : {}),
          evidence_kind: input.evidenceKind,
          evidence_reference_id: input.evidenceReferenceId,
        },
      }),
      'POST /v1/business/{id}/reviews',
    );
  }

  async replyToBusinessReview(
    businessId: string,
    reviewId: string,
    body: string,
  ): Promise<PublicBusinessReviewApiItem> {
    return validatePublicReviewItem(
      await this.request(
        `/v1/business/${encodeURIComponent(businessId)}/reviews/${encodeURIComponent(reviewId)}/reply`,
        {
          method: 'PUT',
          body: { body: body.trim() },
        },
      ),
      'PUT /v1/business/{id}/reviews/{reviewId}/reply',
    );
  }
}
