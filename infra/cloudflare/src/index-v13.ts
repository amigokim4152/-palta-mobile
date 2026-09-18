import baseWorker from './index';

const MAP_STYLE_VERSION = 'palta-v1.3';

const CONTEXT_POI_KINDS = [
  'hospital',
  'clinic',
  'doctors',
  'dentist',
  'school',
  'college',
  'university',
  'library',
  'townhall',
  'fire_station',
  'police',
  'station',
  'bus_stop',
  'post_office',
  'park',
  'playground',
  'cemetery',
  'charging_station',
  'fuel',
  'recycling',
  'toilets',
] as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function layerById(style: any, id: string): any | undefined {
  return Array.isArray(style?.layers)
    ? style.layers.find((layer: any) => layer?.id === id)
    : undefined;
}

export function upgradeChileStyleV13(input: any): any {
  const style = clone(input);
  style.metadata = {
    ...(style.metadata ?? {}),
    'palta:style-version': MAP_STYLE_VERSION,
  };

  const roadsMajor = layerById(style, 'roads-major');
  if (roadsMajor) {
    roadsMajor.filter = [
      'match',
      ['get', 'kind'],
      ['highway', 'major_road'],
      true,
      false,
    ];
  }

  const roadLabels = layerById(style, 'road-labels');
  if (roadLabels) {
    roadLabels.minzoom = 11;
    roadLabels.filter = [
      'all',
      ['has', 'name'],
      [
        'match',
        ['get', 'kind'],
        ['highway', 'major_road'],
        true,
        false,
      ],
    ];
    roadLabels.layout = {
      ...(roadLabels.layout ?? {}),
      'symbol-spacing': 380,
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        11,
        10,
        15,
        12.5,
      ],
    };
  }

  if (roadLabels && !layerById(style, 'road-labels-local')) {
    const localLabels = clone(roadLabels);
    localLabels.id = 'road-labels-local';
    localLabels.minzoom = 14;
    localLabels.filter = [
      'all',
      ['has', 'name'],
      [
        'match',
        ['get', 'kind'],
        ['minor_road', 'path'],
        true,
        false,
      ],
    ];
    localLabels.layout = {
      ...(localLabels.layout ?? {}),
      'symbol-spacing': 500,
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        14,
        9.5,
        15,
        10.5,
      ],
    };
    localLabels.paint = {
      ...(localLabels.paint ?? {}),
      'text-color': '#7B827D',
      'text-halo-width': 1.2,
    };

    const roadLabelIndex = style.layers.findIndex(
      (layer: any) => layer?.id === 'road-labels',
    );
    style.layers.splice(roadLabelIndex + 1, 0, localLabels);
  }

  const poiLabels = layerById(style, 'poi-labels');
  if (poiLabels) {
    poiLabels.minzoom = 13;
    poiLabels.filter = [
      'all',
      ['has', 'name'],
      [
        'match',
        ['get', 'kind'],
        [...CONTEXT_POI_KINDS],
        true,
        false,
      ],
    ];
    poiLabels.layout = {
      ...(poiLabels.layout ?? {}),
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        13,
        9.5,
        15,
        11,
      ],
    };
  }

  return style;
}

type BaseFetch = typeof baseWorker.fetch;
type Env = Parameters<BaseFetch>[1];

async function baseJson(
  request: Request,
  env: Env,
): Promise<{ value: any; headers: Headers; status: number }> {
  const getRequest = new Request(request.url, {
    method: 'GET',
    headers: request.headers,
  });
  const response = await baseWorker.fetch(getRequest, env);
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (
      request.method !== 'GET' &&
      request.method !== 'HEAD' &&
      request.method !== 'OPTIONS'
    ) {
      return baseWorker.fetch(request, env);
    }

    if (url.pathname === '/health') {
      const base = await baseJson(request, env);
      return jsonResponse(
        request,
        {
          ...base.value,
          mapStyleVersion: MAP_STYLE_VERSION,
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
        upgradeChileStyleV13(base.value),
        base.headers,
        base.status,
      );
    }

    return baseWorker.fetch(request, env);
  },
};
