import type { HomeApiGlanceItem, HomeApiItem, HomeApiResponse } from '../api/homeApiContract.js';

const DEMO_GLANCE: readonly HomeApiGlanceItem[] = [
  { id: 'home-demo-weather', capability_key: 'glance.weather', label: 'CLIMA', value: 'Ver pronóstico', source_domain: 'weather', data_mode: 'demo' },
  { id: 'home-demo-traffic', capability_key: 'glance.traffic', label: 'TRÁNSITO', value: 'Revisa tu ruta', source_domain: 'traffic', data_mode: 'demo' },
  { id: 'home-demo-local', capability_key: 'glance.local', label: 'TU ZONA', value: 'Vida local', source_domain: 'local-life', data_mode: 'demo' },
  { id: 'home-demo-economy', capability_key: 'glance.economy', label: 'CAMBIO · UF', value: 'Datos de hoy', source_domain: 'economy', data_mode: 'demo' },
];

export type HomeDisplayMode = 'development_demo' | 'personalized';

export function homeDisplayMode(environment: string): HomeDisplayMode {
  return environment === 'development' || environment === 'preview'
    ? 'development_demo'
    : 'personalized';
}

/** Keep development coverage independent of the API's incidental demo flags. */
export function prepareHomeDisplay(
  response: HomeApiResponse | undefined,
  environment: string,
  demoItems: readonly HomeApiItem[],
): HomeApiResponse {
  if (homeDisplayMode(environment) === 'personalized') {
    return {
      ...response,
      demo_mode: false,
      items: (response?.items ?? []).filter((item) => item.data_mode !== 'demo'),
      glance: (response?.glance ?? []).filter((item) => item.data_mode !== 'demo'),
    };
  }

  const items = response?.items ?? [];
  const keys = new Set(items.map((item) => item.capability_key).filter(Boolean));
  const glance = response?.glance ?? [];
  const glanceKeys = new Set(glance.map((item) => item.capability_key).filter(Boolean));
  return {
    ...response,
    demo_mode: true,
    items: [
      ...items,
      ...demoItems.filter((item) => !item.capability_key || !keys.has(item.capability_key)),
    ],
    glance: [
      ...glance,
      ...DEMO_GLANCE.filter((item) => !item.capability_key || !glanceKeys.has(item.capability_key)),
    ],
  };
}
