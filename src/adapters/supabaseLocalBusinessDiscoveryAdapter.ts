import type { BusinessOperationalState } from '../business/businessOperationalState.js';
import type { LocalBusinessDiscoveryItem } from '../business/localBusinessDiscovery.js';
import { readLocalBusinessDiscoveryPreview } from '../business/localBusinessDiscoveryPreview.js';

export type LocalBusinessSearchInput = Readonly<{
  latitude: number;
  longitude: number;
  radiusM?: number;
  query?: string;
  comunaCode?: string;
  limit?: number;
}>;

export interface LocalBusinessDiscoveryRepository {
  search(input: LocalBusinessSearchInput): Promise<readonly LocalBusinessDiscoveryItem[]>;
}

type RpcResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type ServerFetch = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<RpcResponse>;

export type SupabaseLocalBusinessDiscoveryAdapterOptions = Readonly<{
  projectUrl: string;
  serviceRoleKey: string;
  fetch: ServerFetch;
}>;

const OPERATIONAL_STATES = new Set<BusinessOperationalState>([
  'open_now',
  'closed_now',
  'closed_today',
  'temporarily_closed',
  'seasonal_closed',
  'paused',
  'permanently_closed',
  'unknown_or_stale',
]);

function record(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function cleanOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const clean = value.trim();
  return clean || undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function operationalState(value: unknown): BusinessOperationalState | undefined {
  return typeof value === 'string' && OPERATIONAL_STATES.has(value as BusinessOperationalState)
    ? (value as BusinessOperationalState)
    : undefined;
}

function publicLocation(value: unknown): { lat: number; lng: number } | undefined {
  const row = record(value);
  if (!row) return undefined;
  const lat = finiteNumber(row.lat);
  const lng = finiteNumber(row.lng);
  if (lat === undefined || lng === undefined) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return { lat, lng };
}

function validateSearchInput(input: LocalBusinessSearchInput): void {
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new Error('invalid_local_business_search_latitude');
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new Error('invalid_local_business_search_longitude');
  }
  if (input.radiusM !== undefined && (!Number.isInteger(input.radiusM) || input.radiusM < 100 || input.radiusM > 100_000)) {
    throw new Error('invalid_local_business_search_radius');
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200)) {
    throw new Error('invalid_local_business_search_limit');
  }
  if (input.query !== undefined && input.query.length > 200) {
    throw new Error('invalid_local_business_search_query');
  }
  if (input.comunaCode !== undefined && input.comunaCode.length > 32) {
    throw new Error('invalid_local_business_search_comuna');
  }
}

function normalizeRow(value: unknown): LocalBusinessDiscoveryItem | undefined {
  const row = record(value);
  if (!row) return undefined;
  const entityId = cleanOptionalText(row.entity_id);
  const name = cleanOptionalText(row.name);
  if (!entityId || !name || row.entity_type !== 'business') return undefined;

  const distance = finiteNumber(row.distance_m);
  const state = operationalState(row.operational_state);
  const location = publicLocation(row.location);
  const categoryKey = cleanOptionalText(row.category_key);
  const verificationStatus = cleanOptionalText(row.verification_status);
  const confirmedAt = cleanOptionalText(row.operational_confirmed_at);
  const preview = readLocalBusinessDiscoveryPreview({ preview: row.preview });

  return {
    entityId,
    entityType: 'business',
    name,
    ...(categoryKey ? { categoryKey } : {}),
    ...(distance !== undefined && distance >= 0 ? { distanceM: Math.round(distance) } : {}),
    ...(verificationStatus ? { verificationStatus } : {}),
    ...(state ? { operationalState: state } : {}),
    ...(confirmedAt ? { operationalConfirmedAt: confirmedAt } : {}),
    preview,
    ...(location ? { location } : {}),
  };
}

/**
 * Server-only adapter. The service-role credential must never be bundled into the
 * mobile app. Public clients call Palta API, which delegates to this repository.
 */
export class SupabaseLocalBusinessDiscoveryAdapter implements LocalBusinessDiscoveryRepository {
  private readonly projectUrl: string;
  private readonly serviceRoleKey: string;
  private readonly fetchImpl: ServerFetch;

  constructor(options: SupabaseLocalBusinessDiscoveryAdapterOptions) {
    const projectUrl = options.projectUrl.trim().replace(/\/$/, '');
    const serviceRoleKey = options.serviceRoleKey.trim();
    if (!/^https:\/\//.test(projectUrl)) throw new Error('invalid_supabase_project_url');
    if (!serviceRoleKey) throw new Error('missing_supabase_service_role_key');
    this.projectUrl = projectUrl;
    this.serviceRoleKey = serviceRoleKey;
    this.fetchImpl = options.fetch;
  }

  async search(input: LocalBusinessSearchInput): Promise<readonly LocalBusinessDiscoveryItem[]> {
    validateSearchInput(input);

    const body = {
      p_lat: input.latitude,
      p_lng: input.longitude,
      p_radius_m: input.radiusM ?? 5000,
      p_query: input.query?.trim() || null,
      p_comuna_code: input.comunaCode?.trim() || null,
      p_limit: input.limit ?? 100,
    };

    const response = await this.fetchImpl(
      `${this.projectUrl}/rest/v1/rpc/local_business_search`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          apikey: this.serviceRoleKey,
          Authorization: `Bearer ${this.serviceRoleKey}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(`local_business_search_failed:${response.status}`);
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) throw new Error('local_business_search_invalid_payload');

    return payload
      .map(normalizeRow)
      .filter((item): item is LocalBusinessDiscoveryItem => Boolean(item));
  }
}
