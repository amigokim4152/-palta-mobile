export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

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

export type HomeApiResponse = {
  generated_at?: string;
  items: HomeApiItem[];
};

export type PaltaRecordClass = 'production' | 'sample' | 'discovery_candidate';
export type OwnerVerificationStatus = 'unverified' | 'claimed' | 'verified' | 'suspended';

export type BusinessEvidence = {
  source_type?: string;
  source_url?: string;
  coordinate_source?: string;
  checked_at?: string;
  fact_verification_status?: string;
};

export type BusinessContact = {
  phone?: string;
  whatsapp?: string;
  website?: string;
  instagram?: string;
  email?: string;
};

export type BusinessHours = {
  day?: string;
  open?: string;
  close?: string;
  raw?: string;
};

export type LocalSearchItem = {
  entity_id: string;
  entity_type: 'place' | 'business' | 'public_service' | 'event';
  name: string;
  category_key?: string;
  record_class?: PaltaRecordClass;
  distance_m?: number;
  verification_status?: OwnerVerificationStatus | string;
  fact_verification_status?: string;
  owner_verification_status?: OwnerVerificationStatus | string;
  operational_state?: string;
  operational_confirmed_at?: string;
  next_open_at?: string;
  address?: string;
  commune?: string;
  /** Exact public point is absent for area-only or hidden-location businesses. */
  location?: { lat: number; lng: number };
};

export type BusinessApiDetail = {
  id: string;
  name: string;
  category_key?: string;
  record_class?: PaltaRecordClass;
  public_listing_status?: string;
  verification_status: OwnerVerificationStatus;
  fact_verification_status?: string;
  owner_verification_status?: OwnerVerificationStatus;
  opening_status?: string;
  address?: string;
  commune?: string;
  region?: string;
  location_precision?: string;
  map_eligible?: boolean;
  location?: { lat: number; lng: number };
  parking?: string;
  hours?: BusinessHours[];
  hours_raw?: string[];
  hours_summary?: string;
  hours_note?: string;
  service_labels?: string[];
  contact?: BusinessContact;
  store_locator_url?: string;
  media_source_url?: string;
  enabled_capabilities?: string[];
  evidence?: BusinessEvidence;
};

export type CareApiTrack = {
  id: string;
  intent_key: string;
  state:
    | 'discover'
    | 'prepare'
    | 'act'
    | 'wait'
    | 'result'
    | 'follow_up'
    | 'outcome'
    | 'cancelled';
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
  constructor(
    message: string,
    readonly status: number,
  ) {
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
    init?: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    },
  ): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    };
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
      throw new PaltaApiError(
        `Palta API request failed: ${response.status}`,
        response.status,
      );
    }
    return response.json();
  }

  async getHome(locale = 'es-CL'): Promise<HomeApiResponse> {
    const payload = expectObject(
      await this.request(`/v1/home?locale=${encodeURIComponent(locale)}`),
      'GET /v1/home',
    );
    if (!Array.isArray(payload.items)) {
      throw new Error('GET /v1/home payload missing items[]');
    }
    return payload as HomeApiResponse;
  }

  async searchLocal(input: {
    latitude: number;
    longitude: number;
    radiusM?: number;
    query?: string;
  }): Promise<LocalSearchItem[]> {
    const params = new URLSearchParams({
      lat: String(input.latitude),
      lng: String(input.longitude),
      radius_m: String(input.radiusM ?? 5000),
    });
    if (input.query) params.set('q', input.query);

    const payload = expectObject(
      await this.request(`/v1/local/search?${params.toString()}`),
      'GET /v1/local/search',
    );
    if (!Array.isArray(payload.items)) {
      throw new Error('GET /v1/local/search payload missing items[]');
    }
    return payload.items as LocalSearchItem[];
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

  async getCare(careTrackId: string): Promise<CareApiTrack> {
    const result = expectObject(
      await this.request(`/v1/care/${encodeURIComponent(careTrackId)}`),
      'GET /v1/care/{id}',
    );
    if (
      typeof result.id !== 'string' ||
      typeof result.intent_key !== 'string' ||
      typeof result.state !== 'string'
    ) {
      throw new Error('GET /v1/care/{id} returned invalid Care track');
    }
    return result as CareApiTrack;
  }

  async createCare(input: {
    intentKey: string;
    subjectEntityId?: string;
    actionType?: string;
    payload?: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<CareApiTrack> {
    const body: Record<string, unknown> = {
      intent_key: input.intentKey,
      payload: input.payload ?? {},
    };
    if (input.subjectEntityId) body.subject_entity_id = input.subjectEntityId;
    if (input.actionType) body.action_type = input.actionType;

    const result = expectObject(
      await this.request('/v1/care', {
        method: 'POST',
        body,
        ...(input.idempotencyKey
          ? { headers: { 'Idempotency-Key': input.idempotencyKey } }
          : {}),
      }),
      'POST /v1/care',
    );

    if (typeof result.id !== 'string' || typeof result.state !== 'string') {
      throw new Error('POST /v1/care returned invalid Care track');
    }
    return result as CareApiTrack;
  }
}
