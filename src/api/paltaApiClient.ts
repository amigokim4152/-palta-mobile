import type { BusinessCapability } from '../business/businessActionPolicy.js';
import type {
  BusinessChannelProvider,
  PublicBusinessChannelLink,
} from '../business/businessChannelConnection.js';
import type { BusinessOperationalState } from '../business/businessOperationalState.js';
import type { OwnerPartnerActionClass } from '../business/ownerPartnerActions.js';

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

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

export type HomeApiResponse = { generated_at?: string; items: HomeApiItem[] };

export type LocalSearchHighlight = {
  kind: 'benefit' | 'post';
  label: string;
};

export type LocalSearchItem = {
  entity_id: string;
  entity_type: 'place' | 'business' | 'public_service' | 'event';
  name: string;
  category_key?: string;
  distance_m?: number;
  verification_status?: string;
  operational_state?: BusinessOperationalState;
  operational_confirmed_at?: string;
  next_open_at?: string;
  /** Lightweight display fields only. Full content still belongs to Business detail. */
  primary_photo_url?: string;
  service_labels?: string[];
  highlight?: LocalSearchHighlight;
  /** Exact public point is absent for area-only or hidden-location businesses. */
  location?: { lat: number; lng: number };
};

export type BusinessApiPostSummary = {
  id: string;
  title: string;
  body?: string;
  published_at?: string;
};

export type BusinessBasicPostsApiResponse = {
  business_id: string;
  items: BusinessApiPostSummary[];
};

export type BusinessBasicPostPublishInput = {
  title: string;
  body?: string;
  idempotencyKey?: string;
};

export type BusinessFollowedUpdateApiItem = {
  id: string;
  business_id: string;
  business_name: string;
  kind: 'post' | 'coupon';
  title: string;
  body?: string;
  occurred_at: string;
  expires_at?: string;
};

export type BusinessFollowedUpdatesApiResponse = {
  generated_at?: string;
  items: BusinessFollowedUpdateApiItem[];
};

export type BusinessBasicCouponApiItem = {
  id: string;
  title: string;
  description?: string;
  redemption_instruction?: string;
  audience: 'public' | 'followers';
  expires_at?: string;
};

export type BusinessBasicCouponsApiResponse = {
  business_id: string;
  items: BusinessBasicCouponApiItem[];
};

export type OwnerBusinessBasicCouponApiResponse = {
  business_id: string;
  coupon?: BusinessBasicCouponApiItem;
};

export type BusinessBasicCouponUpsertInput = {
  title: string;
  description?: string;
  redemptionInstruction?: string;
  audience: 'public' | 'followers';
  expiresAt: string;
};

export type BusinessApiDetail = {
  id: string;
  name: string;
  category_key?: string;
  verification_status: 'unverified' | 'claimed' | 'verified' | 'suspended';
  opening_status?: string;
  operational_state?: BusinessOperationalState;
  operational_confirmed_at?: string;
  next_open_at?: string;
  description?: string;
  hours_summary?: string;
  service_labels?: string[];
  service_area_labels?: string[];
  photo_urls?: string[];
  posts?: BusinessApiPostSummary[];
  enabled_capabilities?: BusinessCapability[];
  channel_links?: PublicBusinessChannelLink[];
  location?: { lat: number; lng: number };
  contact?: {
    phone?: string;
    whatsapp?: string;
    website?: string;
    instagram?: string;
  };
};

export type BusinessRelationshipApiResponse = {
  business_id: string;
  saved: boolean;
  following: boolean;
  regular_customer: boolean;
  updated_at?: string;
};

export type BusinessRelationshipUpdate = {
  saved?: boolean;
  following?: boolean;
};

export type OwnerBusinessGuidanceApiItem = {
  id: string;
  class: OwnerPartnerActionClass;
  title: string;
  reason: string;
  target: string;
  action_required: boolean;
  commercial: 'free' | 'may_be_paid' | 'unknown';
};

export type OwnerBusinessGuidanceApiResponse = {
  business_id: string;
  generated_at?: string;
  items: OwnerBusinessGuidanceApiItem[];
};

export type BusinessPublicChannelProvider = Exclude<BusinessChannelProvider, 'palta' | 'pos'>;

export type BusinessPublicChannelLinkInput = {
  provider: BusinessPublicChannelProvider;
  url: string;
};

export type BusinessPublicChannelLinksApiResponse = {
  business_id: string;
  links: PublicBusinessChannelLink[];
};

export type BusinessOnboardingApiInput = {
  mode: 'claim_existing' | 'create_new';
  businessId?: string;
  businessName: string;
  ownerDescription: string;
  confirmedServiceIds: readonly string[];
  presenceModes: readonly string[];
  serviceAreaIds: readonly string[];
  anchorLocation?: { lat: number; lng: number };
  addressLabel?: string;
  contact?: { phone?: string; whatsapp?: string };
  idempotencyKey?: string;
};

export type BusinessOnboardingApiResult = {
  business_id: string;
  verification_status: 'claimed' | 'verified';
  onboarding_status: 'verification_pending' | 'ready';
};

export type CareApiTrack = {
  id: string;
  intent_key: string;
  state: 'discover' | 'prepare' | 'act' | 'wait' | 'result' | 'follow_up' | 'outcome' | 'cancelled';
  waiting_for?: string;
  expected_at?: string;
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
  constructor(message: string, readonly status: number) {
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
    init?: { method?: string; body?: unknown; headers?: Record<string, string> },
  ): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = { Accept: 'application/json', ...(init?.headers ?? {}) };
    if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const requestInit: { method?: string; headers: Record<string, string>; body?: string } = { headers };
    if (init?.method) requestInit.method = init.method;
    if (init?.body !== undefined) requestInit.body = JSON.stringify(init.body);
    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), requestInit);
    if (!response.ok) throw new PaltaApiError(`Palta API request failed: ${response.status}`, response.status);
    return response.json();
  }

  async getHome(locale = 'es-CL'): Promise<HomeApiResponse> {
    const payload = expectObject(await this.request(`/v1/home?locale=${encodeURIComponent(locale)}`), 'GET /v1/home');
    if (!Array.isArray(payload.items)) throw new Error('GET /v1/home payload missing items[]');
    return payload as HomeApiResponse;
  }

  async searchLocal(input: { latitude: number; longitude: number; radiusM?: number; query?: string }): Promise<LocalSearchItem[]> {
    const params = new URLSearchParams({
      lat: String(input.latitude),
      lng: String(input.longitude),
      radius_m: String(input.radiusM ?? 5000),
    });
    if (input.query) params.set('q', input.query);
    const payload = expectObject(await this.request(`/v1/local/search?${params.toString()}`), 'GET /v1/local/search');
    if (!Array.isArray(payload.items)) throw new Error('GET /v1/local/search payload missing items[]');
    return payload.items as LocalSearchItem[];
  }

  async getFollowedBusinessUpdates(): Promise<BusinessFollowedUpdatesApiResponse> {
    const result = expectObject(
      await this.request('/v1/local-business/following-updates'),
      'GET /v1/local-business/following-updates',
    );
    if (!Array.isArray(result.items)) {
      throw new Error('GET /v1/local-business/following-updates returned invalid updates');
    }
    return result as BusinessFollowedUpdatesApiResponse;
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

  async getBusinessRelationship(businessId: string): Promise<BusinessRelationshipApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/relationship`),
      'GET /v1/business/{id}/relationship',
    );
    if (
      typeof result.business_id !== 'string' ||
      typeof result.saved !== 'boolean' ||
      typeof result.following !== 'boolean' ||
      typeof result.regular_customer !== 'boolean'
    ) {
      throw new Error('GET /v1/business/{id}/relationship returned invalid relationship');
    }
    return result as BusinessRelationshipApiResponse;
  }

  async updateBusinessRelationship(
    businessId: string,
    update: BusinessRelationshipUpdate,
  ): Promise<BusinessRelationshipApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/relationship`, {
        method: 'PUT',
        body: update,
      }),
      'PUT /v1/business/{id}/relationship',
    );
    if (
      typeof result.business_id !== 'string' ||
      typeof result.saved !== 'boolean' ||
      typeof result.following !== 'boolean' ||
      typeof result.regular_customer !== 'boolean'
    ) {
      throw new Error('PUT /v1/business/{id}/relationship returned invalid relationship');
    }
    return result as BusinessRelationshipApiResponse;
  }

  async getBusinessBasicCoupons(businessId: string): Promise<BusinessBasicCouponsApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/basic-coupons`),
      'GET /v1/business/{id}/basic-coupons',
    );
    if (typeof result.business_id !== 'string' || !Array.isArray(result.items)) {
      throw new Error('GET /v1/business/{id}/basic-coupons returned invalid coupons');
    }
    return result as BusinessBasicCouponsApiResponse;
  }

  async getOwnerBusinessBasicCoupon(businessId: string): Promise<OwnerBusinessBasicCouponApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/owner-basic-coupon`),
      'GET /v1/business/{id}/owner-basic-coupon',
    );
    if (typeof result.business_id !== 'string') {
      throw new Error('GET /v1/business/{id}/owner-basic-coupon returned invalid coupon');
    }
    return result as OwnerBusinessBasicCouponApiResponse;
  }

  async upsertBusinessBasicCoupon(
    businessId: string,
    input: BusinessBasicCouponUpsertInput,
  ): Promise<BusinessBasicCouponsApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/basic-coupon`, {
        method: 'PUT',
        body: {
          title: input.title,
          ...(input.description ? { description: input.description } : {}),
          ...(input.redemptionInstruction ? { redemption_instruction: input.redemptionInstruction } : {}),
          audience: input.audience,
          expires_at: input.expiresAt,
        },
      }),
      'PUT /v1/business/{id}/basic-coupon',
    );
    if (typeof result.business_id !== 'string' || !Array.isArray(result.items)) {
      throw new Error('PUT /v1/business/{id}/basic-coupon returned invalid coupons');
    }
    return result as BusinessBasicCouponsApiResponse;
  }

  async revokeBusinessBasicCoupon(businessId: string): Promise<BusinessBasicCouponsApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/basic-coupon`, {
        method: 'PUT',
        body: { status: 'revoked' },
      }),
      'PUT /v1/business/{id}/basic-coupon',
    );
    if (typeof result.business_id !== 'string' || !Array.isArray(result.items)) {
      throw new Error('PUT /v1/business/{id}/basic-coupon returned invalid coupons');
    }
    return result as BusinessBasicCouponsApiResponse;
  }

  async publishBusinessBasicPost(
    businessId: string,
    input: BusinessBasicPostPublishInput,
  ): Promise<BusinessBasicPostsApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/basic-posts`, {
        method: 'POST',
        body: {
          title: input.title,
          ...(input.body ? { body: input.body } : {}),
        },
        ...(input.idempotencyKey ? { headers: { 'Idempotency-Key': input.idempotencyKey } } : {}),
      }),
      'POST /v1/business/{id}/basic-posts',
    );
    if (typeof result.business_id !== 'string' || !Array.isArray(result.items)) {
      throw new Error('POST /v1/business/{id}/basic-posts returned invalid posts');
    }
    return result as BusinessBasicPostsApiResponse;
  }

  async archiveBusinessBasicPost(
    businessId: string,
    postId: string,
  ): Promise<BusinessBasicPostsApiResponse> {
    const result = expectObject(
      await this.request(
        `/v1/business/${encodeURIComponent(businessId)}/basic-posts/${encodeURIComponent(postId)}`,
        { method: 'PUT', body: { status: 'archived' } },
      ),
      'PUT /v1/business/{id}/basic-posts/{postId}',
    );
    if (typeof result.business_id !== 'string' || !Array.isArray(result.items)) {
      throw new Error('PUT /v1/business/{id}/basic-posts/{postId} returned invalid posts');
    }
    return result as BusinessBasicPostsApiResponse;
  }

  async getOwnerBusinessGuidance(businessId: string): Promise<OwnerBusinessGuidanceApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/owner-guidance`),
      'GET /v1/business/{id}/owner-guidance',
    );
    if (typeof result.business_id !== 'string' || !Array.isArray(result.items)) {
      throw new Error('GET /v1/business/{id}/owner-guidance returned invalid guidance');
    }
    return result as OwnerBusinessGuidanceApiResponse;
  }

  async getBusinessPublicChannelLinks(businessId: string): Promise<BusinessPublicChannelLinksApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/public-channel-links`),
      'GET /v1/business/{id}/public-channel-links',
    );
    if (typeof result.business_id !== 'string' || !Array.isArray(result.links)) {
      throw new Error('GET /v1/business/{id}/public-channel-links returned invalid links');
    }
    return result as BusinessPublicChannelLinksApiResponse;
  }

  async updateBusinessPublicChannelLinks(
    businessId: string,
    links: readonly BusinessPublicChannelLinkInput[],
  ): Promise<BusinessPublicChannelLinksApiResponse> {
    const result = expectObject(
      await this.request(`/v1/business/${encodeURIComponent(businessId)}/public-channel-links`, {
        method: 'PUT',
        body: { links },
      }),
      'PUT /v1/business/{id}/public-channel-links',
    );
    if (typeof result.business_id !== 'string' || !Array.isArray(result.links)) {
      throw new Error('PUT /v1/business/{id}/public-channel-links returned invalid links');
    }
    return result as BusinessPublicChannelLinksApiResponse;
  }

  async registerBusiness(input: BusinessOnboardingApiInput): Promise<BusinessOnboardingApiResult> {
    const result = expectObject(
      await this.request('/v1/business/onboarding', {
        method: 'POST',
        body: {
          mode: input.mode,
          ...(input.businessId ? { business_id: input.businessId } : {}),
          business_name: input.businessName,
          owner_description: input.ownerDescription,
          confirmed_service_ids: input.confirmedServiceIds,
          presence_modes: input.presenceModes,
          service_area_ids: input.serviceAreaIds,
          ...(input.anchorLocation ? { anchor_location: input.anchorLocation } : {}),
          ...(input.addressLabel ? { address_label: input.addressLabel } : {}),
          ...(input.contact ? { contact: input.contact } : {}),
        },
        ...(input.idempotencyKey ? { headers: { 'Idempotency-Key': input.idempotencyKey } } : {}),
      }),
      'POST /v1/business/onboarding',
    );
    if (
      typeof result.business_id !== 'string' ||
      (result.verification_status !== 'claimed' && result.verification_status !== 'verified')
    ) {
      throw new Error('POST /v1/business/onboarding returned invalid result');
    }
    return result as BusinessOnboardingApiResult;
  }

  async createCare(input: { intentKey: string; linkedEntityId?: string; expectedAt?: string; idempotencyKey?: string }): Promise<CareApiTrack> {
    const result = expectObject(
      await this.request('/v1/care', {
        method: 'POST',
        body: {
          intent_key: input.intentKey,
          ...(input.linkedEntityId ? { linked_entity_id: input.linkedEntityId } : {}),
          ...(input.expectedAt ? { expected_at: input.expectedAt } : {}),
        },
        ...(input.idempotencyKey ? { headers: { 'Idempotency-Key': input.idempotencyKey } } : {}),
      }),
      'POST /v1/care',
    );
    if (typeof result.id !== 'string' || typeof result.state !== 'string') {
      throw new Error('POST /v1/care returned invalid care track');
    }
    return result as CareApiTrack;
  }

  async getCare(careId: string): Promise<CareApiTrack> {
    const result = expectObject(
      await this.request(`/v1/care/${encodeURIComponent(careId)}`),
      'GET /v1/care/{id}',
    );
    if (typeof result.id !== 'string' || typeof result.state !== 'string') {
      throw new Error('GET /v1/care/{id} returned invalid care track');
    }
    return result as CareApiTrack;
  }
}
