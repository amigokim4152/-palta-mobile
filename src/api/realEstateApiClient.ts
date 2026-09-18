import type { FetchLike } from './paltaApiClient.js';
import { serializeRealEstateListingQuery } from '../realEstate/realEstateQueryParams.js';
import type { RealEstateListingQuery } from '../realEstate/realEstateRepository.js';

export type RealEstateListingApiItem = {
  listing_id: string;
  property_id: string;
  transaction_type: 'sale' | 'rent' | 'temporary_rent';
  property_type: 'apartment' | 'house' | 'room' | 'office' | 'commercial' | 'land' | 'parcel' | 'warehouse';
  publisher_type: 'owner_direct' | 'broker' | 'real_estate_business';
  publisher_label: string;
  publisher_business_id?: string;
  publisher_user_id?: string;
  price_clp?: number;
  price_uf?: number;
  common_expenses_clp?: number;
  published_at: string;
  expires_at?: string;
  status: 'draft' | 'active' | 'paused' | 'closed';
  comuna: string;
  sector: string;
  display_address?: string;
  latitude?: number;
  longitude?: number;
  bedrooms?: number;
  bathrooms?: number;
  parking_spaces?: number;
  usable_area_m2?: number;
  total_area_m2?: number;
  building_id?: string;
  photo_url?: string;
  featured?: boolean;
};

export type RealEstateListingSearchApiResponse = {
  generated_at?: string;
  items: RealEstateListingApiItem[];
};

export type RealEstateContextEvidenceApi = {
  verification: 'verified' | 'corroborated' | 'needs_verification' | 'demo';
  source_id?: string;
  observed_at?: string;
};

export type RealEstateBuildingContextApi = {
  building_id: string;
  name?: string;
  place_id?: string;
  display_address?: string;
  year_built?: number;
  floors?: number;
  unit_count?: number;
  evidence: RealEstateContextEvidenceApi;
};

export type RealEstateNearbyContextApi = {
  kind: 'transit' | 'school' | 'health' | 'park' | 'grocery' | 'business';
  source_core: 'map' | 'transport' | 'business' | 'education' | 'health' | 'municipal';
  entity_id: string;
  place_id?: string;
  display_label?: string;
  distance_meters?: number;
  walking_minutes?: number;
  evidence: RealEstateContextEvidenceApi;
};

export type RealEstatePropertyContextApiResponse = {
  property_id: string;
  generated_at: string;
  building?: RealEstateBuildingContextApi;
  nearby: RealEstateNearbyContextApi[];
};

export type RealEstateApiClientOptions = {
  baseUrl: string;
  fetch: FetchLike;
  getAccessToken?: () => Promise<string | null>;
};

export class RealEstateApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RealEstateApiError';
  }
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isListingItem(value: unknown): value is RealEstateListingApiItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const transactionTypes = ['sale', 'rent', 'temporary_rent'];
  const propertyTypes = ['apartment', 'house', 'room', 'office', 'commercial', 'land', 'parcel', 'warehouse'];
  const publisherTypes = ['owner_direct', 'broker', 'real_estate_business'];
  const statuses = ['draft', 'active', 'paused', 'closed'];

  if (
    typeof row.listing_id !== 'string' ||
    typeof row.property_id !== 'string' ||
    typeof row.transaction_type !== 'string' || !transactionTypes.includes(row.transaction_type) ||
    typeof row.property_type !== 'string' || !propertyTypes.includes(row.property_type) ||
    typeof row.publisher_type !== 'string' || !publisherTypes.includes(row.publisher_type) ||
    typeof row.publisher_label !== 'string' ||
    typeof row.published_at !== 'string' ||
    typeof row.status !== 'string' || !statuses.includes(row.status) ||
    typeof row.comuna !== 'string' ||
    typeof row.sector !== 'string'
  ) {
    return false;
  }

  for (const key of [
    'price_clp', 'price_uf', 'common_expenses_clp', 'latitude', 'longitude',
    'bedrooms', 'bathrooms', 'parking_spaces', 'usable_area_m2', 'total_area_m2',
  ] as const) {
    if (row[key] !== undefined && !isFiniteNumber(row[key])) return false;
  }

  return true;
}

function isEvidence(value: unknown): value is RealEstateContextEvidenceApi {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const states = ['verified', 'corroborated', 'needs_verification', 'demo'];
  return typeof row.verification === 'string' && states.includes(row.verification) &&
    (row.source_id === undefined || typeof row.source_id === 'string') &&
    (row.observed_at === undefined || typeof row.observed_at === 'string');
}

function isBuildingContext(value: unknown): value is RealEstateBuildingContextApi {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.building_id === 'string' &&
    (row.name === undefined || typeof row.name === 'string') &&
    (row.place_id === undefined || typeof row.place_id === 'string') &&
    (row.display_address === undefined || typeof row.display_address === 'string') &&
    (row.year_built === undefined || isFiniteNumber(row.year_built)) &&
    (row.floors === undefined || isFiniteNumber(row.floors)) &&
    (row.unit_count === undefined || isFiniteNumber(row.unit_count)) &&
    isEvidence(row.evidence);
}

function isNearbyContext(value: unknown): value is RealEstateNearbyContextApi {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const kinds = ['transit', 'school', 'health', 'park', 'grocery', 'business'];
  const cores = ['map', 'transport', 'business', 'education', 'health', 'municipal'];
  return typeof row.kind === 'string' && kinds.includes(row.kind) &&
    typeof row.source_core === 'string' && cores.includes(row.source_core) &&
    typeof row.entity_id === 'string' &&
    (row.place_id === undefined || typeof row.place_id === 'string') &&
    (row.display_label === undefined || typeof row.display_label === 'string') &&
    (row.distance_meters === undefined || isFiniteNumber(row.distance_meters)) &&
    (row.walking_minutes === undefined || isFiniteNumber(row.walking_minutes)) &&
    isEvidence(row.evidence);
}

function validateSearchResponse(value: unknown, label: string): RealEstateListingSearchApiResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} returned a non-object payload`);
  }
  const row = value as Record<string, unknown>;
  if (!Array.isArray(row.items) || row.items.some((item) => !isListingItem(item))) {
    throw new Error(`${label} returned invalid real-estate listings`);
  }
  if (row.generated_at !== undefined && typeof row.generated_at !== 'string') {
    throw new Error(`${label} returned invalid generated_at`);
  }
  return row as RealEstateListingSearchApiResponse;
}

function validateDetailResponse(value: unknown, label: string): RealEstateListingApiItem {
  if (!isListingItem(value)) {
    throw new Error(`${label} returned invalid real-estate listing`);
  }
  return value;
}

function validatePropertyContext(
  value: unknown,
  label: string,
): RealEstatePropertyContextApiResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} returned a non-object payload`);
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.property_id !== 'string' ||
    typeof row.generated_at !== 'string' ||
    (row.building !== undefined && !isBuildingContext(row.building)) ||
    !Array.isArray(row.nearby) ||
    row.nearby.some((item) => !isNearbyContext(item))
  ) {
    throw new Error(`${label} returned invalid property context`);
  }
  return row as RealEstatePropertyContextApiResponse;
}

function queryString(query: RealEstateListingQuery): string {
  const entries = Object.entries(serializeRealEstateListingQuery(query));
  if (!entries.length) return '';
  return `?${entries.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}`;
}

export class RealEstateApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;

  constructor(options: RealEstateApiClientOptions) {
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetch;
    this.getAccessToken = options.getAccessToken;
  }

  private async request(path: string): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), { headers });
    if (!response.ok) {
      throw new RealEstateApiError(
        `Palta real-estate API request failed: ${response.status}`,
        response.status,
      );
    }
    return response.json();
  }

  async searchListings(query: RealEstateListingQuery): Promise<RealEstateListingSearchApiResponse> {
    return validateSearchResponse(
      await this.request(`/v1/real-estate/listings${queryString(query)}`),
      'GET /v1/real-estate/listings',
    );
  }

  async getListing(listingId: string): Promise<RealEstateListingApiItem> {
    return validateDetailResponse(
      await this.request(`/v1/real-estate/listings/${encodeURIComponent(listingId)}`),
      'GET /v1/real-estate/listings/{id}',
    );
  }

  async getPropertyContext(propertyId: string): Promise<RealEstatePropertyContextApiResponse> {
    return validatePropertyContext(
      await this.request(`/v1/real-estate/properties/${encodeURIComponent(propertyId)}/context`),
      'GET /v1/real-estate/properties/{propertyId}/context',
    );
  }
}
