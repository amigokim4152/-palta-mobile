import v16Worker, { upgradeChileStyleV16 } from './index-v16';

const MAP_STYLE_VERSION = 'palta-v1.7';
const SYMBOL_FONT_OBJECT_KEY =
  'palta/cl/maps/fonts/noto-sans-symbols-2/current/NotoSansSymbols2-Regular.ttf';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type BaseFetch = typeof v16Worker.fetch;
type Env = Parameters<BaseFetch>[1] & {
  MAPS: {
    head(key: string): Promise<any>;
    get(key: string, options?: any): Promise<any>;
  };
};

async function baseJson(
  request: Request,
  env: Env,
): Promise<{ value: any; headers: Headers; status: number }> {
  const getRequest = new Request(request.url, {
    method: 'GET',
    headers: request.headers,
  });
  const response = await v16Worker.fetch(getRequest, env);
  const value = response.status === 204 ? null : await response.json();
  return {
    value,
    headers: new Headers(response.headers),
    status: response.status,
  };
}

function jsonResponse(
  request: Request,
  value: unknown,
  headers: Headers,
  status = 200,
): Response {
  const body = JSON.stringify(value);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Content-Length', String(new TextEncoder().encode(body).length));
  return new Response(request.method === 'HEAD' ? null : body, {
    status,
    headers,
  });
}

function corsHeaders(): Headers {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'If-None-Match, If-Modified-Since',
    'Access-Control-Expose-Headers': 'Content-Length, ETag, Last-Modified',
  });
}

async function serveStaticR2(
  request: Request,
  env: Env,
  key: string,
): Promise<Response> {
  const headers = corsHeaders();
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD, OPTIONS' },
    });
  }

  if (request.method === 'HEAD') {
    const object = await env.MAPS.head(key);
    if (!object) return new Response(null, { status: 404, headers });
    object.writeHttpMetadata?.(headers);
    if (object.httpEtag) headers.set('ETag', object.httpEtag);
    headers.set('Content-Length', String(object.size));
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(null, { status: 200, headers });
  }

  const object = await env.MAPS.get(key, { onlyIf: request.headers });
  if (!object || !('body' in object)) {
    return new Response('Not found', { status: 404, headers });
  }
  object.writeHttpMetadata?.(headers);
  if (object.httpEtag) headers.set('ETag', object.httpEtag);
  headers.set('Content-Length', String(object.size));
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { status: 200, headers });
}

export function upgradeChileStyleV17(input: any, origin: string): any {
  const style = upgradeChileStyleV16(clone(input));
  style.metadata = {
    ...(style.metadata ?? {}),
    'palta:style-version': MAP_STYLE_VERSION,
  };
  style['font-faces'] = {
    ...(style['font-faces'] ?? {}),
    'Noto Sans Symbols 2': [
      { url: `${origin}/maps/cl/fonts/NotoSansSymbols2.ttf` },
    ],
  };
  return style;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/maps/cl/fonts/NotoSansSymbols2.ttf') {
      return serveStaticR2(request, env, SYMBOL_FONT_OBJECT_KEY);
    }

    if (url.pathname === '/health') {
      const base = await baseJson(request, env);
      return jsonResponse(
        request,
        {
          ...base.value,
          mapStyleVersion: MAP_STYLE_VERSION,
          mapSymbolFontPath: '/maps/cl/fonts/NotoSansSymbols2.ttf',
        },
        base.headers,
        base.status,
      );
    }

    if (url.pathname === '/maps/cl/manifest.json') {
      const base = await baseJson(request, env);
      return jsonResponse(
        request,
        {
          ...base.value,
          style_version: MAP_STYLE_VERSION,
          symbol_font_url: `${url.origin}/maps/cl/fonts/NotoSansSymbols2.ttf`,
        },
        base.headers,
        base.status,
      );
    }

    if (
      url.pathname === '/maps/cl/style.json' ||
      url.pathname === '/maps/style.json'
    ) {
      const base = await baseJson(request, env);
      return jsonResponse(
        request,
        upgradeChileStyleV17(base.value, url.origin),
        base.headers,
        base.status,
      );
    }

    return v16Worker.fetch(request, env);
  },
};
