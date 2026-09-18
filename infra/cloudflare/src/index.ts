import { publicNewsObjectKey } from '../../../src/news/publicNewsRoutes.js';

type R2RangeLike =
  | { offset: number; length: number }
  | { suffix: number };

type R2ObjectLike = {
  size: number;
  httpEtag: string;
  range?: R2RangeLike;
  writeHttpMetadata(headers: Headers): void;
};

type R2ObjectBodyLike = R2ObjectLike & {
  body: ReadableStream;
};

type R2BucketLike = {
  head(key: string): Promise<R2ObjectLike | null>;
  get(
    key: string,
    options?: {
      onlyIf?: Headers;
      range?: Headers;
    },
  ): Promise<R2ObjectBodyLike | R2ObjectLike | null>;
};

type Env = {
  MAPS: R2BucketLike;
  MAP_OBJECT_KEY?: string;
  NEWS_PUBLIC?: R2BucketLike;
  NEWS_PUBLIC_ENABLED?: string;
};

type PublicNewsErrorReason =
  | 'public_news_disabled'
  | 'public_news_storage_not_bound'
  | 'public_news_object_not_found';

function corsHeaders(): Headers {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, If-None-Match, If-Modified-Since',
    'Access-Control-Expose-Headers':
      'Accept-Ranges, Content-Length, Content-Range, ETag, Last-Modified, X-Palta-News-Reason',
  });
}

function jsonHeaders(): Headers {
  const headers = corsHeaders();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=60');
  return headers;
}

function publicNewsError(
  request: Request,
  status: 404 | 503,
  reason: PublicNewsErrorReason,
  state: 'BLOCKED' | 'UNAVAILABLE',
  headers = jsonHeaders(),
): Response {
  headers.set('X-Palta-News-Reason', reason);
  if (request.method === 'HEAD') {
    return new Response(null, { status, headers });
  }
  return Response.json({ status: state, reason }, { status, headers });
}

function applyObjectHeaders(
  object: R2ObjectLike,
  headers: Headers,
): void {
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  // Conservative while the object key is still stable rather than content-hashed.
  headers.set('Cache-Control', 'public, max-age=300, s-maxage=3600');
}

function contentRange(
  range: R2RangeLike,
  total: number,
): { value: string; length: number } {
  if ('suffix' in range) {
    const length = Math.min(range.suffix, total);
    const start = total - length;
    return {
      value: `bytes ${start}-${total - 1}/${total}`,
      length,
    };
  }

  const length = Math.min(range.length, total - range.offset);
  return {
    value: `bytes ${range.offset}-${range.offset + length - 1}/${total}`,
    length,
  };
}

async function serveMapObject(
  request: Request,
  env: Env,
): Promise<Response> {
  const key = env.MAP_OBJECT_KEY ?? 'maps/santiago/santiago.pmtiles';
  const headers = corsHeaders();

  if (request.method === 'HEAD') {
    const object = await env.MAPS.head(key);
    if (!object) {
      return new Response(null, { status: 404, headers });
    }

    applyObjectHeaders(object, headers);
    headers.set('Content-Length', String(object.size));
    return new Response(null, { status: 200, headers });
  }

  const object = await env.MAPS.get(key, {
    onlyIf: request.headers,
    range: request.headers,
  });

  if (!object) {
    return new Response('Not found', { status: 404, headers });
  }

  applyObjectHeaders(object, headers);

  if (!('body' in object)) {
    return new Response(null, { status: 412, headers });
  }

  if (object.range) {
    const resolved = contentRange(object.range, object.size);
    headers.set('Content-Range', resolved.value);
    headers.set('Content-Length', String(resolved.length));
    return new Response(object.body, {
      status: 206,
      headers,
    });
  }

  headers.set('Content-Length', String(object.size));
  return new Response(object.body, {
    status: 200,
    headers,
  });
}

async function servePublicNewsObject(
  request: Request,
  env: Env,
  objectKey: string,
): Promise<Response> {
  const headers = jsonHeaders();

  // Independent edge gate: stale R2 objects cannot become public merely because they exist.
  if (env.NEWS_PUBLIC_ENABLED !== 'true') {
    return publicNewsError(request, 404, 'public_news_disabled', 'BLOCKED', headers);
  }
  if (!env.NEWS_PUBLIC) {
    return publicNewsError(request, 503, 'public_news_storage_not_bound', 'UNAVAILABLE', headers);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    headers.set('Allow', 'GET, HEAD, OPTIONS');
    return new Response(null, { status: 405, headers });
  }

  const metadata = await env.NEWS_PUBLIC.head(objectKey);
  if (!metadata) {
    return publicNewsError(request, 404, 'public_news_object_not_found', 'UNAVAILABLE', headers);
  }
  headers.set('ETag', metadata.httpEtag);
  headers.set('Content-Length', String(metadata.size));

  if (request.headers.get('if-none-match') === metadata.httpEtag) {
    headers.delete('Content-Length');
    return new Response(null, { status: 304, headers });
  }
  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers });
  }

  const object = await env.NEWS_PUBLIC.get(objectKey);
  if (!object || !('body' in object)) {
    headers.delete('Content-Length');
    return publicNewsError(request, 404, 'public_news_object_not_found', 'UNAVAILABLE', headers);
  }
  return new Response(object.body, { status: 200, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (url.pathname === '/health') {
      return Response.json({
        ok: true,
        service: 'palta-edge-preflight',
        mapObjectKey:
          env.MAP_OBJECT_KEY ?? 'maps/santiago/santiago.pmtiles',
        publicNewsEnabled: env.NEWS_PUBLIC_ENABLED === 'true',
        publicNewsStorageBound: Boolean(env.NEWS_PUBLIC),
      });
    }

    if (url.pathname === '/maps/santiago.pmtiles') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: {
            Allow: 'GET, HEAD, OPTIONS',
          },
        });
      }
      return serveMapObject(request, env);
    }

    const newsObjectKey = publicNewsObjectKey(url.pathname);
    if (newsObjectKey) {
      return servePublicNewsObject(request, env, newsObjectKey);
    }

    return new Response('Not Found', { status: 404 });
  },
};
