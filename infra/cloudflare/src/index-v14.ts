import v13Worker, { upgradeChileStyleV13 } from './index-v13';

const MAP_STYLE_VERSION = 'palta-v1.4';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function layerById(style: any, id: string): any | undefined {
  return Array.isArray(style?.layers)
    ? style.layers.find((layer: any) => layer?.id === id)
    : undefined;
}

export function upgradeChileStyleV14(input: any): any {
  const style = upgradeChileStyleV13(clone(input));
  style.metadata = {
    ...(style.metadata ?? {}),
    'palta:style-version': MAP_STYLE_VERSION,
  };

  const placeLabels = layerById(style, 'place-labels');
  if (placeLabels) {
    placeLabels.layout = {
      ...(placeLabels.layout ?? {}),
      'symbol-sort-key': ['coalesce', ['get', 'min_zoom'], 99],
      'text-padding': 4,
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4,
        10.5,
        8,
        12,
        12,
        13.5,
        15,
        15.5,
      ],
    };
  }

  const roadLabels = layerById(style, 'road-labels');
  if (roadLabels) {
    roadLabels.minzoom = 12;
    roadLabels.layout = {
      ...(roadLabels.layout ?? {}),
      'symbol-spacing': 520,
      'text-max-angle': 25,
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        12,
        9.5,
        15,
        11.5,
      ],
    };
  }

  const localRoadLabels = layerById(style, 'road-labels-local');
  if (localRoadLabels) {
    localRoadLabels.minzoom = 14.7;
    localRoadLabels.layout = {
      ...(localRoadLabels.layout ?? {}),
      'symbol-spacing': 760,
      'text-max-angle': 25,
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        14.7,
        8.8,
        15,
        9.6,
      ],
    };
    localRoadLabels.paint = {
      ...(localRoadLabels.paint ?? {}),
      'text-color': '#858B87',
      'text-halo-width': 1.1,
    };
  }

  const poiLabels = layerById(style, 'poi-labels');
  if (poiLabels) {
    poiLabels.minzoom = 14;
    poiLabels.layout = {
      ...(poiLabels.layout ?? {}),
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        14,
        9.2,
        15,
        10.2,
      ],
      'text-padding': 4,
    };
  }

  const waterLabels = layerById(style, 'water-labels');
  if (waterLabels) waterLabels.minzoom = 10;

  return style;
}

type BaseFetch = typeof v13Worker.fetch;
type Env = Parameters<BaseFetch>[1];

async function baseJson(
  request: Request,
  env: Env,
): Promise<{ value: any; headers: Headers; status: number }> {
  const getRequest = new Request(request.url, {
    method: 'GET',
    headers: request.headers,
  });
  const response = await v13Worker.fetch(getRequest, env);
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
      return v13Worker.fetch(request, env);
    }

    if (url.pathname === '/health') {
      const base = await baseJson(request, env);
      return jsonResponse(
        request,
        { ...base.value, mapStyleVersion: MAP_STYLE_VERSION },
        base.headers,
        base.status,
      );
    }

    if (url.pathname === '/maps/cl/manifest.json') {
      const base = await baseJson(request, env);
      return jsonResponse(
        request,
        { ...base.value, style_version: MAP_STYLE_VERSION },
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
        upgradeChileStyleV14(base.value),
        base.headers,
        base.status,
      );
    }

    return v13Worker.fetch(request, env);
  },
};
