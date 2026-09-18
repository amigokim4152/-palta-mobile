import v17Worker, { upgradeChileStyleV17 } from './index-v17';

const MAP_STYLE_VERSION = 'palta-v1.8';

const ANCHOR_POI_KINDS = [
  'hospital',
  'school',
  'university',
  'townhall',
  'station',
  'bus_stop',
  'park',
  'supermarket',
  'grocery',
  'police',
  'fire_station',
  'fuel',
] as const;

const SECONDARY_POI_KINDS = [
  'clinic',
  'doctors',
  'dentist',
  'college',
  'library',
  'post_office',
  'playground',
  'charging_station',
  'recycling',
  'toilets',
  'cemetery',
] as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function layerById(style: any, id: string): any | undefined {
  return Array.isArray(style?.layers)
    ? style.layers.find((layer: any) => layer?.id === id)
    : undefined;
}

function poiFilter(kinds: readonly string[]): any[] {
  return [
    'all',
    ['has', 'name'],
    ['match', ['get', 'kind'], [...kinds], true, false],
  ];
}

export function upgradeChileStyleV18(input: any, origin: string): any {
  const style = upgradeChileStyleV17(clone(input), origin);
  style.metadata = {
    ...(style.metadata ?? {}),
    'palta:style-version': MAP_STYLE_VERSION,
  };

  const poiLabels = layerById(style, 'poi-labels');
  if (poiLabels) {
    poiLabels.minzoom = 14.4;
    poiLabels.filter = poiFilter(SECONDARY_POI_KINDS);
    poiLabels.layout = {
      ...(poiLabels.layout ?? {}),
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        14.4,
        9,
        16,
        10.2,
      ],
      'text-padding': 8,
      'symbol-sort-key': ['coalesce', ['get', 'sort_rank'], 9999],
    };

    if (!layerById(style, 'poi-labels-anchor')) {
      const anchorLabels = clone(poiLabels);
      anchorLabels.id = 'poi-labels-anchor';
      anchorLabels.minzoom = 12.2;
      anchorLabels.filter = poiFilter(ANCHOR_POI_KINDS);
      anchorLabels.layout = {
        ...(anchorLabels.layout ?? {}),
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          12.2,
          9.4,
          14,
          10.2,
          16,
          11,
        ],
        'text-padding': 10,
        'text-max-width': 9,
        'symbol-sort-key': ['coalesce', ['get', 'sort_rank'], 9999],
      };
      anchorLabels.paint = {
        ...(anchorLabels.paint ?? {}),
        'text-color': '#4B5C51',
        'text-halo-color': '#F8FAF6',
        'text-halo-width': 1.5,
        'text-halo-blur': 0.25,
      };

      const poiIndex = style.layers.findIndex(
        (layer: any) => layer?.id === 'poi-labels',
      );
      style.layers.splice(Math.max(0, poiIndex), 0, anchorLabels);
    }
  }

  const landuse = layerById(style, 'landuse');
  if (landuse) {
    const landuseIndex = style.layers.findIndex(
      (layer: any) => layer?.id === 'landuse',
    );
    const contextLayers = [
      {
        id: 'landuse-health',
        type: 'fill',
        source: 'chile',
        'source-layer': 'landuse',
        minzoom: 12,
        filter: ['==', ['get', 'kind'], 'hospital'],
        paint: {
          'fill-color': '#F5E8E5',
          'fill-opacity': 0.72,
        },
      },
      {
        id: 'landuse-education',
        type: 'fill',
        source: 'chile',
        'source-layer': 'landuse',
        minzoom: 12.5,
        filter: [
          'match',
          ['get', 'kind'],
          ['school', 'college', 'university', 'kindergarten'],
          true,
          false,
        ],
        paint: {
          'fill-color': '#F3EDDA',
          'fill-opacity': 0.66,
        },
      },
    ];

    for (const layer of contextLayers.reverse()) {
      if (!layerById(style, layer.id)) {
        style.layers.splice(landuseIndex + 1, 0, layer);
      }
    }
  }

  return style;
}

type BaseFetch = typeof v17Worker.fetch;
type Env = Parameters<BaseFetch>[1];

async function baseJson(
  request: Request,
  env: Env,
): Promise<{ value: any; headers: Headers; status: number }> {
  const getRequest = new Request(request.url, {
    method: 'GET',
    headers: request.headers,
  });
  const response = await v17Worker.fetch(getRequest, env);
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
      return v17Worker.fetch(request, env);
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
        upgradeChileStyleV18(base.value, url.origin),
        base.headers,
        base.status,
      );
    }

    return v17Worker.fetch(request, env);
  },
};
