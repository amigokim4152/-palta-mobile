import v16Worker from './index-v16';
import {
  findProductionBusiness,
  searchProductionBusinesses,
  toLocalSearchItem,
  type BusinessSnapshot,
} from '../../../src/local/businessSnapshot';
import {
  findProductionPlace,
  placeToLocalSearchItem,
  searchProductionPlaces,
  type LocalPlaceSnapshot,
} from '../../../src/local/localPlaceSnapshot';

type BaseFetch = typeof v16Worker.fetch;
type BaseEnv = Parameters<BaseFetch>[1];

type R2JsonObject = {
  body: ReadableStream;
};

type JsonR2Bucket = {
  get(key: string): Promise<R2JsonObject | null>;
};

type Env = BaseEnv & {
  MAPS: JsonR2Bucket;
  BUSINESS_OBJECT_KEY?: string;
  LOCAL_PLACE_OBJECT_KEY?: string;
};

const DEFAULT_BUSINESS_OBJECT_KEY =
  'palta/cl/local-business/current/businesses.json';
const DEFAULT_LOCAL_PLACE_OBJECT_KEY =
  'palta/cl/local-place/current/places.json';

function apiHeaders(cacheControl = 'public, max-age=60, s-maxage=300'): Headers {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cacheControl,
  });
}

function apiJson(
  request: Request,
  value: unknown,
  status = 200,
  cacheControl?: string,
): Response {
  const body = JSON.stringify(value);
  const headers = apiHeaders(cacheControl);
  headers.set('Content-Length', String(new TextEncoder().encode(body).length));
  return new Response(request.method === 'HEAD' ? null : body, {
    status,
    headers,
  });
}

async function loadJsonObject<T>(env: Env, key: string, label: string): Promise<T | null> {
  const object = await env.MAPS.get(key);
  if (!object) return null;
  const text = await new Response(object.body).text();
  const parsed = JSON.parse(text) as T & { items?: unknown[] };
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error(`invalid_${label}_snapshot`);
  }
  return parsed as T;
}

function loadBusinessSnapshot(env: Env): Promise<BusinessSnapshot | null> {
  return loadJsonObject<BusinessSnapshot>(
    env,
    env.BUSINESS_OBJECT_KEY ?? DEFAULT_BUSINESS_OBJECT_KEY,
    'business',
  );
}

function loadLocalPlaceSnapshot(env: Env): Promise<LocalPlaceSnapshot | null> {
  return loadJsonObject<LocalPlaceSnapshot>(
    env,
    env.LOCAL_PLACE_OBJECT_KEY ?? DEFAULT_LOCAL_PLACE_OBJECT_KEY,
    'local_place',
  );
}

function numberParam(url: URL, key: string): number | null {
  const raw = url.searchParams.get(key);
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function validCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

async function localSearch(request: Request, env: Env, url: URL): Promise<Response> {
  const latitude = numberParam(url, 'lat');
  const longitude = numberParam(url, 'lng');
  if (
    latitude === null ||
    longitude === null ||
    !validCoordinates(latitude, longitude)
  ) {
    return apiJson(request, { error: 'valid_lat_lng_required' }, 400, 'no-store');
  }

  const requestedRadius = numberParam(url, 'radius_m') ?? 5000;
  const radiusM = Math.min(Math.max(Math.round(requestedRadius), 50), 50_000);
  const query = url.searchParams.get('q')?.trim() || undefined;

  const [businessSnapshot, placeSnapshot] = await Promise.all([
    loadBusinessSnapshot(env),
    loadLocalPlaceSnapshot(env),
  ]);
  if (!businessSnapshot && !placeSnapshot) {
    return apiJson(
      request,
      { error: 'local_snapshots_unavailable' },
      503,
      'no-store',
    );
  }

  const searchInput = {
    latitude,
    longitude,
    radiusM,
    ...(query ? { query } : {}),
  };
  const businessItems = businessSnapshot
    ? searchProductionBusinesses(businessSnapshot, searchInput).map(toLocalSearchItem)
    : [];
  const placeItems = placeSnapshot
    ? searchProductionPlaces(placeSnapshot, searchInput).map(placeToLocalSearchItem)
    : [];
  const items = [...businessItems, ...placeItems].sort((a, b) => {
    const left = Number(a.distance_m ?? Number.MAX_SAFE_INTEGER);
    const right = Number(b.distance_m ?? Number.MAX_SAFE_INTEGER);
    return left - right || String(a.name ?? '').localeCompare(String(b.name ?? ''));
  });

  return apiJson(request, {
    checked_at: {
      business: businessSnapshot?.checked_at,
      local_place: placeSnapshot?.checked_at,
    },
    radius_m: radiusM,
    partial: !businessSnapshot || !placeSnapshot,
    items,
  });
}

async function businessDetail(
  request: Request,
  env: Env,
  businessId: string,
): Promise<Response> {
  const snapshot = await loadBusinessSnapshot(env);
  if (!snapshot) {
    return apiJson(request, { error: 'business_snapshot_unavailable' }, 503, 'no-store');
  }
  const business = findProductionBusiness(snapshot, businessId);
  if (!business) {
    return apiJson(request, { error: 'business_not_found' }, 404, 'no-store');
  }
  return apiJson(request, business);
}

async function placeDetail(
  request: Request,
  env: Env,
  placeId: string,
): Promise<Response> {
  const snapshot = await loadLocalPlaceSnapshot(env);
  if (!snapshot) {
    return apiJson(request, { error: 'local_place_snapshot_unavailable' }, 503, 'no-store');
  }
  const place = findProductionPlace(snapshot, placeId);
  if (!place) {
    return apiJson(request, { error: 'place_not_found' }, 404, 'no-store');
  }
  return apiJson(request, place);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && url.pathname.startsWith('/v1/')) {
      return new Response(null, { status: 204, headers: apiHeaders('no-store') });
    }

    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      url.pathname === '/v1/local/search'
    ) {
      try {
        return await localSearch(request, env, url);
      } catch (error) {
        return apiJson(
          request,
          {
            error: 'local_snapshot_error',
            detail: error instanceof Error ? error.message : 'unknown_error',
          },
          500,
          'no-store',
        );
      }
    }

    const businessMatch = url.pathname.match(/^\/v1\/business\/([^/]+)$/);
    if (businessMatch && (request.method === 'GET' || request.method === 'HEAD')) {
      try {
        return await businessDetail(request, env, decodeURIComponent(businessMatch[1]!));
      } catch (error) {
        return apiJson(
          request,
          {
            error: 'business_snapshot_error',
            detail: error instanceof Error ? error.message : 'unknown_error',
          },
          500,
          'no-store',
        );
      }
    }

    const placeMatch = url.pathname.match(/^\/v1\/place\/([^/]+)$/);
    if (placeMatch && (request.method === 'GET' || request.method === 'HEAD')) {
      try {
        return await placeDetail(request, env, decodeURIComponent(placeMatch[1]!));
      } catch (error) {
        return apiJson(
          request,
          {
            error: 'local_place_snapshot_error',
            detail: error instanceof Error ? error.message : 'unknown_error',
          },
          500,
          'no-store',
        );
      }
    }

    return v16Worker.fetch(request, env);
  },
};
