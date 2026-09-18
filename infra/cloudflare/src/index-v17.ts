import v16Worker from './index-v16';
import {
  findProductionBusiness,
  searchProductionBusinesses,
  toLocalSearchItem,
  type BusinessSnapshot,
} from '../../../src/local/businessSnapshot';

type BaseFetch = typeof v16Worker.fetch;
type BaseEnv = Parameters<BaseFetch>[1];

type R2JsonObject = {
  body: ReadableStream;
};

type BusinessR2Bucket = {
  get(key: string): Promise<R2JsonObject | null>;
};

type Env = BaseEnv & {
  MAPS: BusinessR2Bucket;
  BUSINESS_OBJECT_KEY?: string;
};

const DEFAULT_BUSINESS_OBJECT_KEY =
  'palta/cl/local-business/current/businesses.json';

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

async function loadBusinessSnapshot(env: Env): Promise<BusinessSnapshot | null> {
  const key = env.BUSINESS_OBJECT_KEY ?? DEFAULT_BUSINESS_OBJECT_KEY;
  const object = await env.MAPS.get(key);
  if (!object) return null;

  const text = await new Response(object.body).text();
  const parsed = JSON.parse(text) as BusinessSnapshot;
  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error('invalid_business_snapshot');
  }
  return parsed;
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

  const snapshot = await loadBusinessSnapshot(env);
  if (!snapshot) {
    return apiJson(
      request,
      { error: 'business_snapshot_unavailable' },
      503,
      'no-store',
    );
  }

  const matches = searchProductionBusinesses(snapshot, {
    latitude,
    longitude,
    radiusM,
    ...(query ? { query } : {}),
  });

  return apiJson(request, {
    checked_at: snapshot.checked_at,
    radius_m: radiusM,
    items: matches.map(toLocalSearchItem),
  });
}

async function businessDetail(
  request: Request,
  env: Env,
  businessId: string,
): Promise<Response> {
  const snapshot = await loadBusinessSnapshot(env);
  if (!snapshot) {
    return apiJson(
      request,
      { error: 'business_snapshot_unavailable' },
      503,
      'no-store',
    );
  }

  const business = findProductionBusiness(snapshot, businessId);
  if (!business) {
    return apiJson(request, { error: 'business_not_found' }, 404, 'no-store');
  }
  return apiJson(request, business);
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
            error: 'business_snapshot_error',
            detail: error instanceof Error ? error.message : 'unknown_error',
          },
          500,
          'no-store',
        );
      }
    }

    const businessMatch = url.pathname.match(/^\/v1\/business\/([^/]+)$/);
    if (
      businessMatch &&
      (request.method === 'GET' || request.method === 'HEAD')
    ) {
      try {
        return await businessDetail(
          request,
          env,
          decodeURIComponent(businessMatch[1]!),
        );
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

    return v16Worker.fetch(request, env);
  },
};
