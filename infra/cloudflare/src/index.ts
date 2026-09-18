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
};

function corsHeaders(): Headers {
  return new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, If-None-Match, If-Modified-Since',
    'Access-Control-Expose-Headers':
      'Accept-Ranges, Content-Length, Content-Range, ETag, Last-Modified',
  });
}

function jsonHeaders(cacheControl = 'public, max-age=300, s-maxage=3600'): Headers {
  const headers = corsHeaders();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', cacheControl);
  return headers;
}

function applyObjectHeaders(
  object: R2ObjectLike,
  headers: Headers,
): void {
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
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

function buildSantiagoStyle(origin: string) {
  const pmtilesUrl = `pmtiles://${origin}/maps/santiago.pmtiles`;

  return {
    version: 8,
    name: 'Somos Palta · Santiago',
    sources: {
      santiago: {
        type: 'vector',
        url: pmtilesUrl,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#F6F4EF' },
      },
      {
        id: 'earth',
        type: 'fill',
        source: 'santiago',
        'source-layer': 'earth',
        paint: { 'fill-color': '#F6F4EF' },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'santiago',
        'source-layer': 'landcover',
        paint: {
          'fill-color': '#E6EEDF',
          'fill-opacity': 0.72,
        },
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'santiago',
        'source-layer': 'landuse',
        paint: {
          'fill-color': '#ECE9E0',
          'fill-opacity': 0.58,
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'santiago',
        'source-layer': 'water',
        paint: { 'fill-color': '#BCDCE8' },
      },
      {
        id: 'boundaries',
        type: 'line',
        source: 'santiago',
        'source-layer': 'boundaries',
        paint: {
          'line-color': '#C6C1B6',
          'line-width': 0.9,
          'line-opacity': 0.8,
        },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'santiago',
        'source-layer': 'roads',
        paint: {
          'line-color': '#C8C3B8',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            8,
            0.6,
            12,
            1.1,
            14,
            2.2,
            17,
            5,
          ],
        },
      },
      {
        id: 'buildings',
        type: 'fill',
        source: 'santiago',
        'source-layer': 'buildings',
        minzoom: 13,
        paint: {
          'fill-color': '#D7D1C6',
          'fill-outline-color': '#C5BFB4',
        },
      },
    ],
  };
}

async function serveStyle(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        Allow: 'GET, HEAD, OPTIONS',
      },
    });
  }

  const url = new URL(request.url);
  const body = JSON.stringify(buildSantiagoStyle(url.origin));
  const headers = jsonHeaders();
  headers.set('Content-Length', String(new TextEncoder().encode(body).length));

  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers,
  });
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
      return Response.json(
        {
          ok: true,
          service: 'palta-edge-preflight',
          mapObjectKey:
            env.MAP_OBJECT_KEY ?? 'maps/santiago/santiago.pmtiles',
          mapStylePath: '/maps/style.json',
        },
        { headers: jsonHeaders('no-store') },
      );
    }

    if (url.pathname === '/maps/style.json') {
      return serveStyle(request);
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

    return new Response('Not Found', { status: 404 });
  },
};
