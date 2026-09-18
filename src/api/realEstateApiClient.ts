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

export type RealEstateApiClientOptions = {
  baseUrl: string;
  fetch: FetchLike;
  getAccessToken?: () => Promise<string | null>;
};

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
      throw new Error(`Palta real-estate API request failed: ${response.status}`);
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
}
