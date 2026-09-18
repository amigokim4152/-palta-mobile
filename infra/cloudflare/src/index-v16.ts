import v15Worker, { upgradeChileStyleV15 } from './index-v15';

const MAP_STYLE_VERSION = 'palta-v1.6';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function layerById(style: any, id: string): any | undefined {
  return Array.isArray(style?.layers)
    ? style.layers.find((layer: any) => layer?.id === id)
    : undefined;
}

function roadFilter(kindDetails: string[]): any[] {
  return [
    'match',
    ['get', 'kind_detail'],
    kindDetails,
    true,
    false,
  ];
}

function lineLayer(
  id: string,
  filter: any[],
  color: string,
  widths: Array<number>,
): any {
  return {
    id,
    type: 'line',
    source: 'chile',
    'source-layer': 'roads',
    filter,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': color,
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8,
        widths[0],
        11,
        widths[1],
        13,
        widths[2],
        15,
        widths[3],
      ],
      'line-opacity': 0.98,
    },
  };
}

function roadLabelLayer(
  id: string,
  kindDetails: string[],
  minzoom: number,
  spacing: number,
  sizes: [number, number, number, number],
  color: string,
): any {
  const spanishName = [
    'coalesce',
    ['get', 'name:es'],
    ['get', 'name'],
  ];

  return {
    id,
    type: 'symbol',
    source: 'chile',
    'source-layer': 'roads',
    minzoom,
    filter: [
      'all',
      ['has', 'name'],
      roadFilter(kindDetails),
    ],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': spacing,
      'symbol-avoid-edges': true,
      'text-field': spanishName,
      'text-font': ['Noto Sans'],
      'text-size': [
        'interpolate',
        ['linear'],
        ['zoom'],
        10,
        sizes[0],
        12,
        sizes[1],
        14,
        sizes[2],
        15,
        sizes[3],
      ],
      'text-padding': 6,
      'text-max-angle': 22,
      'text-keep-upright': true,
      'text-rotation-alignment': 'map',
      'text-pitch-alignment': 'map',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-optional': true,
    },
    paint: {
      'text-color': color,
      'text-halo-color': '#FFFFFF',
      'text-halo-width': 1.4,
      'text-halo-blur': 0.25,
    },
  };
}

export function upgradeChileStyleV16(input: any): any {
  const style = upgradeChileStyleV15(clone(input));
  style.metadata = {
    ...(style.metadata ?? {}),
    'palta:style-version': MAP_STYLE_VERSION,
  };

  const roads = layerById(style, 'roads');
  if (roads) {
    roads.paint = {
      ...(roads.paint ?? {}),
      'line-color': '#FFFFFF',
      'line-width': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8,
        0.45,
        11,
        0.85,
        13,
        1.45,
        15,
        2.35,
      ],
      'line-opacity': 0.95,
    };
  }

  const roadIndex = style.layers.findIndex((layer: any) => layer?.id === 'roads');
  const majorIndex = style.layers.findIndex((layer: any) => layer?.id === 'roads-major');
  if (majorIndex >= 0) style.layers.splice(majorIndex, 1);

  const hierarchyLayers = [
    lineLayer(
      'roads-highway-casing',
      roadFilter(['motorway', 'motorway_link', 'trunk', 'trunk_link']),
      '#D1B34D',
      [1.8, 3.2, 5.0, 7.8],
    ),
    lineLayer(
      'roads-highway-fill',
      roadFilter(['motorway', 'motorway_link', 'trunk', 'trunk_link']),
      '#F6DA72',
      [1.15, 2.35, 3.7, 6.1],
    ),
    lineLayer(
      'roads-primary-casing',
      roadFilter(['primary', 'primary_link']),
      '#DDC879',
      [1.25, 2.35, 3.75, 5.8],
    ),
    lineLayer(
      'roads-primary-fill',
      roadFilter(['primary', 'primary_link']),
      '#F7E9A9',
      [0.8, 1.65, 2.75, 4.45],
    ),
    lineLayer(
      'roads-secondary-casing',
      roadFilter(['secondary', 'secondary_link']),
      '#E8DCAA',
      [0.8, 1.55, 2.6, 4.2],
    ),
    lineLayer(
      'roads-secondary-fill',
      roadFilter(['secondary', 'secondary_link']),
      '#FBF3CF',
      [0.5, 1.1, 1.85, 3.15],
    ),
    lineLayer(
      'roads-tertiary-fill',
      roadFilter(['tertiary', 'tertiary_link']),
      '#FFFDF6',
      [0.35, 0.75, 1.3, 2.5],
    ),
  ];

  if (roadIndex >= 0) {
    style.layers.splice(roadIndex + 1, 0, ...hierarchyLayers);
  }

  style.layers = style.layers.filter(
    (layer: any) =>
      ![
        'road-labels-highway',
        'road-labels',
        'road-labels-local',
      ].includes(layer?.id),
  );

  const buildingIndex = style.layers.findIndex(
    (layer: any) => layer?.id === 'buildings',
  );
  const labelInsertIndex = buildingIndex >= 0 ? buildingIndex + 1 : style.layers.length;

  const labelLayers = [
    roadLabelLayer(
      'road-labels-highway',
      ['motorway', 'motorway_link', 'trunk', 'trunk_link'],
      9.5,
      1050,
      [10.8, 11.4, 12.2, 12.8],
      '#4D493A',
    ),
    roadLabelLayer(
      'road-labels',
      ['primary', 'primary_link', 'secondary', 'secondary_link'],
      11.5,
      880,
      [9.5, 10.2, 11.0, 11.6],
      '#5D5C52',
    ),
    roadLabelLayer(
      'road-labels-local',
      [
        'tertiary',
        'tertiary_link',
        'residential',
        'unclassified',
        'service',
        'living_street',
      ],
      15.6,
      1200,
      [8.2, 8.4, 8.8, 9.2],
      '#7B807C',
    ),
  ];

  style.layers.splice(labelInsertIndex, 0, ...labelLayers);

  const placeLabels = layerById(style, 'place-labels');
  if (placeLabels) {
    placeLabels.layout = {
      ...(placeLabels.layout ?? {}),
      'text-padding': 8,
    };
  }

  const poiLabels = layerById(style, 'poi-labels');
  if (poiLabels) {
    poiLabels.minzoom = 15.2;
    poiLabels.layout = {
      ...(poiLabels.layout ?? {}),
      'text-padding': 8,
      'text-size': 9.2,
    };
  }

  return style;
}

type BaseFetch = typeof v15Worker.fetch;
type Env = Parameters<BaseFetch>[1];

async function baseJson(
  request: Request,
  env: Env,
): Promise<{ value: any; headers: Headers; status: number }> {
  const getRequest = new Request(request.url, {
    method: 'GET',
    headers: request.headers,
  });
  const response = await v15Worker.fetch(getRequest, env);
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
      return v15Worker.fetch(request, env);
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
        upgradeChileStyleV16(base.value),
        base.headers,
        base.status,
      );
    }

    return v15Worker.fetch(request, env);
  },
};
