type R2RangeLike =
  | { offset?: number; length?: number; suffix?: never }
  | { suffix: number; offset?: never; length?: never };

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
      range?: Headers | R2RangeLike;
    },
  ): Promise<R2ObjectBodyLike | R2ObjectLike | null>;
};

type Env = {
  MAPS: R2BucketLike;
  MAP_OBJECT_KEY?: string;
  MAP_VERSION?: string;
};

const DEFAULT_MAP_VERSION = '2026.09.17.1';
const DEFAULT_MAP_OBJECT_KEY =
  'palta/cl/maps/basemap/versions/2026.09.17.1/basemap.pmtiles';
const MAP_STYLE_VERSION = 'palta-v1.2';
const MAP_FONT_OBJECT_KEY =
  'palta/cl/maps/fonts/noto-sans/1edf95b/NotoSans.ttf';
const MAP_FONT_LICENSE_OBJECT_KEY =
  'palta/cl/maps/fonts/noto-sans/1edf95b/OFL.txt';

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

function applyObjectHeaders(object: R2ObjectLike, headers: Headers): void {
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
}

function contentRange(
  range: R2RangeLike,
  total: number,
): { value: string; length: number } {
  if (typeof range.suffix === 'number') {
    const length = Math.min(Math.max(range.suffix, 0), total);
    const start = Math.max(total - length, 0);
    return {
      value: `bytes ${start}-${Math.max(total - 1, 0)}/${total}`,
      length,
    };
  }

  const offset = Math.min(Math.max(range.offset ?? 0, 0), total);
  const requestedLength = range.length ?? Math.max(total - offset, 0);
  const length = Math.min(
    Math.max(requestedLength, 0),
    Math.max(total - offset, 0),
  );
  const end = length > 0 ? offset + length - 1 : offset;

  return {
    value: `bytes ${offset}-${end}/${total}`,
    length,
  };
}

const spanishName = ['coalesce', ['get', 'name:es'], ['get', 'name']];

function buildChileStyle(origin: string, version: string) {
  const fontUrl = `${origin}/maps/cl/fonts/NotoSans.ttf`;

  return {
    version: 8,
    name: `Somos Palta · Chile · ${version}`,
    metadata: {
      'palta:country': 'CL',
      'palta:map-version': version,
      'palta:style-version': MAP_STYLE_VERSION,
    },
    center: [-70.65, -33.45],
    zoom: 10,
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    'font-faces': {
      'Noto Sans': [{ url: fontUrl }],
    },
    sources: {
      chile: {
        type: 'vector',
        url: `pmtiles://${origin}/maps/cl/basemap.pmtiles`,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#F7F8F4' },
      },
      {
        id: 'earth',
        type: 'fill',
        source: 'chile',
        'source-layer': 'earth',
        paint: { 'fill-color': '#F7F8F4' },
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'chile',
        'source-layer': 'landcover',
        paint: {
          'fill-color': '#E4EFDF',
          'fill-opacity': 0.82,
        },
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'chile',
        'source-layer': 'landuse',
        paint: {
          'fill-color': '#F0EEE7',
          'fill-opacity': 0.72,
        },
      },
      {
        id: 'landuse-green',
        type: 'fill',
        source: 'chile',
        'source-layer': 'landuse',
        filter: [
          'match',
          ['get', 'kind'],
          [
            'park',
            'garden',
            'grass',
            'recreation_ground',
            'cemetery',
            'pitch',
            'forest',
            'wood',
          ],
          true,
          false,
        ],
        paint: {
          'fill-color': '#DCEBD5',
          'fill-opacity': 0.88,
        },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'chile',
        'source-layer': 'water',
        paint: { 'fill-color': '#B9DCE9' },
      },
      {
        id: 'boundaries',
        type: 'line',
        source: 'chile',
        'source-layer': 'boundaries',
        paint: {
          'line-color': '#AEB7AF',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4,
            0.45,
            8,
            0.7,
            12,
            1,
          ],
          'line-opacity': 0.55,
        },
      },
      {
        id: 'roads-casing',
        type: 'line',
        source: 'chile',
        'source-layer': 'roads',
        paint: {
          'line-color': '#D4D9D2',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            0.7,
            8,
            1,
            12,
            1.8,
            14,
            3.2,
            15,
            4.4,
          ],
          'line-opacity': 0.94,
        },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'chile',
        'source-layer': 'roads',
        paint: {
          'line-color': '#FFFFFF',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            5,
            0.35,
            8,
            0.65,
            12,
            1.25,
            14,
            2.4,
            15,
            3.5,
          ],
          'line-opacity': 0.98,
        },
      },
      {
        id: 'roads-major',
        type: 'line',
        source: 'chile',
        'source-layer': 'roads',
        filter: [
          'match',
          ['get', 'kind'],
          ['motorway', 'trunk', 'primary', 'major_road'],
          true,
          false,
        ],
        paint: {
          'line-color': '#F6E9A9',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            6,
            0.7,
            10,
            1.4,
            13,
            2.5,
            15,
            3.9,
          ],
          'line-opacity': 0.95,
        },
      },
      {
        id: 'buildings',
        type: 'fill',
        source: 'chile',
        'source-layer': 'buildings',
        minzoom: 13,
        paint: {
          'fill-color': '#DDD9D0',
          'fill-opacity': 0.86,
          'fill-outline-color': '#CCC8BE',
        },
      },
      {
        id: 'water-labels',
        type: 'symbol',
        source: 'chile',
        'source-layer': 'water',
        minzoom: 9,
        filter: ['has', 'name'],
        layout: {
          'text-field': spanishName,
          'text-font': ['Noto Sans'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            9,
            10,
            15,
            12,
          ],
          'text-max-width': 8,
        },
        paint: {
          'text-color': '#527889',
          'text-halo-color': '#F7F8F4',
          'text-halo-width': 1.3,
        },
      },
      {
        id: 'place-labels',
        type: 'symbol',
        source: 'chile',
        'source-layer': 'places',
        minzoom: 4,
        filter: ['has', 'name'],
        layout: {
          'text-field': spanishName,
          'text-font': ['Noto Sans'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            4,
            10,
            8,
            12,
            12,
            14,
            15,
            16,
          ],
          'text-max-width': 9,
          'text-letter-spacing': 0.01,
          'text-allow-overlap': false,
          'text-optional': true,
        },
        paint: {
          'text-color': '#344239',
          'text-halo-color': '#F7F8F4',
          'text-halo-width': 1.5,
          'text-halo-blur': 0.4,
        },
      },
      {
        id: 'road-labels',
        type: 'symbol',
        source: 'chile',
        'source-layer': 'roads',
        minzoom: 12,
        filter: ['has', 'name'],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 320,
          'text-field': spanishName,
          'text-font': ['Noto Sans'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            12,
            10,
            15,
            12,
          ],
          'text-max-angle': 30,
          'text-padding': 2,
          'text-keep-upright': true,
        },
        paint: {
          'text-color': '#68716B',
          'text-halo-color': '#FFFFFF',
          'text-halo-width': 1.5,
          'text-halo-blur': 0.3,
        },
      },
      {
        id: 'poi-labels',
        type: 'symbol',
        source: 'chile',
        'source-layer': 'pois',
        minzoom: 14,
        filter: ['has', 'name'],
        layout: {
          'text-field': spanishName,
          'text-font': ['Noto Sans'],
          'text-size': 10.5,
          'text-max-width': 8,
          'text-offset': [0, 0.7],
          'text-optional': true,
        },
        paint: {
          'text-color': '#5C665F',
          'text-halo-color': '#F7F8F4',
          'text-halo-width': 1.2,
        },
      },
    ],
  };
}

function buildManifest(origin: string, objectKey: string, version: string) {
  return {
    schema_version: 1,
    country: 'CL',
    status: 'production',
    version,
    style_version: MAP_STYLE_VERSION,
    object_key: objectKey,
    style_url: `${origin}/maps/cl/style.json`,
    metadata_url: `${origin}/maps/cl/metadata.json`,
    pmtiles_url: `${origin}/maps/cl/basemap.pmtiles`,
    immutable_version_url: `${origin}/maps/cl/versions/${version}/basemap.pmtiles`,
    font_url: `${origin}/maps/cl/fonts/NotoSans.ttf`,
    font_license_url: `${origin}/maps/cl/fonts/OFL.txt`,
    attribution: '© OpenStreetMap contributors',
  };
}

async function serveJson(
  request: Request,
  value: unknown,
  cacheControl = 'public, max-age=300, s-maxage=3600',
): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD, OPTIONS' },
    });
  }

  const body = JSON.stringify(value);
  const headers = jsonHeaders(cacheControl);
  headers.set('Content-Length', String(new TextEncoder().encode(body).length));
  return new Response(request.method === 'HEAD' ? null : body, {
    status: 200,
    headers,
  });
}

async function readObjectRange(
  env: Env,
  key: string,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  const range = new Headers({
    Range: `bytes=${offset}-${offset + length - 1}`,
  });
  const object = await env.MAPS.get(key, { range });
  if (!object || !('body' in object)) {
    throw new Error(`Unable to read PMTiles range ${offset}+${length}`);
  }
  return new Uint8Array(await new Response(object.body).arrayBuffer());
}

function uint64(view: DataView, offset: number): number {
  const value = view.getBigUint64(offset, true);
  const number = Number(value);
  if (!Number.isSafeInteger(number)) {
    throw new Error('PMTiles offset exceeds JavaScript safe integer range');
  }
  return number;
}

async function decodePmtilesMetadata(
  env: Env,
  key: string,
): Promise<Record<string, unknown>> {
  const header = await readObjectRange(env, key, 0, 127);
  const magic = new TextDecoder().decode(header.slice(0, 7));
  if (magic !== 'PMTiles') throw new Error('Invalid PMTiles magic');

  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const pmtilesVersion = header[7];
  const metadataOffset = uint64(view, 24);
  const metadataLength = uint64(view, 32);
  const internalCompression = header[97];
  const tileCompression = header[98];
  const tileType = header[99];
  const minZoom = header[100];
  const maxZoom = header[101];
  const minLon = view.getInt32(102, true) / 10_000_000;
  const minLat = view.getInt32(106, true) / 10_000_000;
  const maxLon = view.getInt32(110, true) / 10_000_000;
  const maxLat = view.getInt32(114, true) / 10_000_000;
  const centerZoom = header[118];
  const centerLon = view.getInt32(119, true) / 10_000_000;
  const centerLat = view.getInt32(123, true) / 10_000_000;

  let metadataBytes = await readObjectRange(
    env,
    key,
    metadataOffset,
    metadataLength,
  );

  if (internalCompression === 2) {
    const decompressed = new Blob([metadataBytes])
      .stream()
      .pipeThrough(new DecompressionStream('gzip'));
    metadataBytes = new Uint8Array(
      await new Response(decompressed).arrayBuffer(),
    );
  } else if (internalCompression !== 1) {
    throw new Error(
      `Unsupported PMTiles internal compression: ${internalCompression}`,
    );
  }

  const metadata = JSON.parse(new TextDecoder().decode(metadataBytes)) as Record<
    string,
    unknown
  >;

  return {
    pmtiles_version: pmtilesVersion,
    internal_compression: internalCompression,
    tile_compression: tileCompression,
    tile_type: tileType,
    min_zoom: minZoom,
    max_zoom: maxZoom,
    bounds: [minLon, minLat, maxLon, maxLat],
    center: [centerLon, centerLat, centerZoom],
    metadata,
  };
}

function parseByteRange(
  value: string,
  total: number,
): { offset: number; length: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) return null;

  const startText = match[1];
  const endText = match[2];

  if (!startText && !endText) return null;

  if (!startText) {
    const suffix = Number(endText);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null;
    const length = Math.min(suffix, total);
    return { offset: Math.max(total - length, 0), length };
  }

  const start = Number(startText);
  if (!Number.isSafeInteger(start) || start < 0 || start >= total) {
    return null;
  }

  if (!endText) {
    return { offset: start, length: total - start };
  }

  const requestedEnd = Number(endText);
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) {
    return null;
  }

  const end = Math.min(requestedEnd, total - 1);
  return { offset: start, length: end - start + 1 };
}

async function serveR2Object(
  request: Request,
  env: Env,
  key: string,
): Promise<Response> {
  const headers = corsHeaders();

  if (request.method === 'HEAD') {
    const object = await env.MAPS.head(key);
    if (!object) return new Response(null, { status: 404, headers });
    applyObjectHeaders(object, headers);
    headers.set('Content-Length', String(object.size));
    return new Response(null, { status: 200, headers });
  }

  const rangeHeader = request.headers.get('Range');

  if (rangeHeader) {
    const head = await env.MAPS.head(key);
    if (!head) return new Response('Not found', { status: 404, headers });

    const range = parseByteRange(rangeHeader, head.size);
    if (!range) {
      applyObjectHeaders(head, headers);
      headers.set('Content-Range', `bytes */${head.size}`);
      return new Response(null, { status: 416, headers });
    }

    // MapLibre Native may send If-None-Match together with Range when a
    // previously cached PMTiles byte range is revalidated. Preserve that
    // validator: unchanged data becomes 304, while changed content
    // continues as a normal 206 response.
    const object = await env.MAPS.get(key, {
      onlyIf: request.headers,
      range,
    });
    if (!object) {
      return new Response('Not found', { status: 404, headers });
    }

    applyObjectHeaders(object, headers);

    if (!('body' in object)) {
      if (
        request.headers.has('If-None-Match') ||
        request.headers.has('If-Modified-Since')
      ) {
        return new Response(null, { status: 304, headers });
      }
      return new Response(null, { status: 412, headers });
    }
    const end = range.offset + range.length - 1;
    headers.set(
      'Content-Range',
      `bytes ${range.offset}-${end}/${head.size}`,
    );
    headers.set('Content-Length', String(range.length));
    return new Response(object.body, { status: 206, headers });
  }

  const object = await env.MAPS.get(key, {
    onlyIf: request.headers,
  });

  if (!object) return new Response('Not found', { status: 404, headers });
  applyObjectHeaders(object, headers);

  if (!('body' in object)) {
    if (
      request.headers.has('If-None-Match') ||
      request.headers.has('If-Modified-Since')
    ) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(null, { status: 412, headers });
  }

  headers.set('Content-Length', String(object.size));
  return new Response(object.body, { status: 200, headers });
}

function getOnly(request: Request): Response | null {
  if (request.method === 'GET' || request.method === 'HEAD') return null;
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'GET, HEAD, OPTIONS' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const version = env.MAP_VERSION ?? DEFAULT_MAP_VERSION;
    const objectKey = env.MAP_OBJECT_KEY ?? DEFAULT_MAP_OBJECT_KEY;

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === '/health') {
      return serveJson(
        request,
        {
          ok: true,
          service: 'palta-map-edge',
          country: 'CL',
          mapObjectKey: objectKey,
          mapVersion: version,
          mapStyleVersion: MAP_STYLE_VERSION,
          mapManifestPath: '/maps/cl/manifest.json',
          mapStylePath: '/maps/cl/style.json',
          mapMetadataPath: '/maps/cl/metadata.json',
          mapFontPath: '/maps/cl/fonts/NotoSans.ttf',
        },
        'no-store',
      );
    }

    if (url.pathname === '/maps/cl/manifest.json') {
      return serveJson(
        request,
        buildManifest(url.origin, objectKey, version),
        'public, max-age=60, s-maxage=300',
      );
    }

    if (url.pathname === '/maps/cl/style.json') {
      return serveJson(request, buildChileStyle(url.origin, version));
    }

    if (url.pathname === '/maps/cl/metadata.json') {
      try {
        const metadata = await decodePmtilesMetadata(env, objectKey);
        return serveJson(
          request,
          {
            country: 'CL',
            map_version: version,
            style_version: MAP_STYLE_VERSION,
            ...metadata,
          },
          'public, max-age=3600, s-maxage=86400',
        );
      } catch (error) {
        return serveJson(
          request,
          {
            ok: false,
            error: error instanceof Error ? error.message : 'metadata_error',
          },
          'no-store',
        );
      }
    }

    if (url.pathname === '/maps/cl/fonts/NotoSans.ttf') {
      const invalid = getOnly(request);
      if (invalid) return invalid;
      return serveR2Object(request, env, MAP_FONT_OBJECT_KEY);
    }

    if (url.pathname === '/maps/cl/fonts/OFL.txt') {
      const invalid = getOnly(request);
      if (invalid) return invalid;
      return serveR2Object(request, env, MAP_FONT_LICENSE_OBJECT_KEY);
    }

    if (url.pathname === '/maps/cl/basemap.pmtiles') {
      const invalid = getOnly(request);
      if (invalid) return invalid;
      return serveR2Object(request, env, objectKey);
    }

    const versionMatch = url.pathname.match(
      /^\/maps\/cl\/versions\/([A-Za-z0-9._-]+)\/basemap\.pmtiles$/,
    );
    if (versionMatch) {
      const invalid = getOnly(request);
      if (invalid) return invalid;
      const immutableKey = `palta/cl/maps/basemap/versions/${versionMatch[1]}/basemap.pmtiles`;
      return serveR2Object(request, env, immutableKey);
    }

    if (url.pathname === '/maps/style.json') {
      return serveJson(request, buildChileStyle(url.origin, version));
    }

    if (url.pathname === '/maps/santiago.pmtiles') {
      const invalid = getOnly(request);
      if (invalid) return invalid;
      return serveR2Object(request, env, objectKey);
    }

    return new Response('Not Found', { status: 404 });
  },
};
