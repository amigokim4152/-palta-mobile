import v14Worker, { upgradeChileStyleV14 } from './index-v14';

const MAP_STYLE_VERSION = 'palta-v1.5';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function layerById(style: any, id: string): any | undefined {
  return Array.isArray(style?.layers)
    ? style.layers.find((layer: any) => layer?.id === id)
    : undefined;
}

export function upgradeChileStyleV15(input: any): any {
  const style = upgradeChileStyleV14(clone(input));
  style.metadata = {
    ...(style.metadata ?? {}),
    'palta:style-version': MAP_STYLE_VERSION,
  };

  const roadLabels = layerById(style, 'road-labels');
  if (roadLabels) {
    roadLabels.minzoom = 11.8;
    roadLabels.filter = [
      'all',
      ['has', 'name'],
      [
        'match',
        ['get', 'kind_detail'],
        ['motorway', 'trunk', 'primary', 'secondary'],
        true,
        false,
      ],
    ];
    roadLabels.layout = {
      ...(roadLabels.layout ?? {}),
      'symbol-spacing': 620,
      'text-padding': 5,
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        12,
        9.3,
        15,
        11.2,
      ],
    };
  }

  const localRoadLabels = layerById(style, 'road-labels-local');
  if (localRoadLabels) {
    localRoadLabels.minzoom = 15.3;
    localRoadLabels.filter = [
      'all',
      ['has', 'name'],
      [
        'match',
        ['get', 'kind_detail'],
        ['tertiary', 'residential', 'unclassified', 'service', 'living_street'],
        true,
        false,
      ],
    ];
    localRoadLabels.layout = {
      ...(localRoadLabels.layout ?? {}),
      'symbol-spacing': 900,
      'text-padding': 5,
      'text-size': 9,
    };
  }

  const poiLabels = layerById(style, 'poi-labels');
  if (poiLabels) {
    poiLabels.minzoom = 15;
    poiLabels.layout = {
      ...(poiLabels.layout ?? {}),
      'text-padding': 6,
      'text-size': 9.5,
    };
  }

  return style;
}

type BaseFetch = typeof v14Worker.fetch;
type Env = Parameters<BaseFetch>[1];

async function baseJson(
  request: Request,
  env: Env,
): Promise<{ value: any; headers: Headers; status: number }> {
  const getRequest = new Request(request.url, {
    method: 'GET',
    headers: request.headers,
  });
  const response = await v14Worker.fetch(getRequest, env);
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
      return v14Worker.fetch(request, env);
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
        upgradeChileStyleV15(base.value),
        base.headers,
        base.status,
      );
    }

    return v14Worker.fetch(request, env);
  },
};
