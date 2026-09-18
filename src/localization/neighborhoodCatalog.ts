import type { PaltaLocale } from './locales.js';

export const NEIGHBORHOOD_ES = {
  'neighborhood.a11y.mapResults': 'Resultados del mapa',
  'neighborhood.a11y.showMoreResults': 'Mostrar más resultados',
  'neighborhood.a11y.showMoreMap': 'Mostrar más mapa',
} as const;

export type NeighborhoodCopyKey = keyof typeof NEIGHBORHOOD_ES;
type NeighborhoodCatalog = Partial<Record<NeighborhoodCopyKey, string>>;

const KO: NeighborhoodCatalog = {
  'neighborhood.a11y.mapResults': '지도 검색 결과',
  'neighborhood.a11y.showMoreResults': '검색 결과 더 보기',
  'neighborhood.a11y.showMoreMap': '지도 더 보기',
};

const EN: NeighborhoodCatalog = {
  'neighborhood.a11y.mapResults': 'Map results',
  'neighborhood.a11y.showMoreResults': 'Show more results',
  'neighborhood.a11y.showMoreMap': 'Show more map',
};

const ZH_HANS: NeighborhoodCatalog = {
  'neighborhood.a11y.mapResults': '地图搜索结果',
  'neighborhood.a11y.showMoreResults': '显示更多结果',
  'neighborhood.a11y.showMoreMap': '显示更多地图',
};

const CATALOGS: Record<PaltaLocale, NeighborhoodCatalog> = {
  'es-CL': NEIGHBORHOOD_ES,
  ko: KO,
  en: EN,
  'zh-Hans': ZH_HANS,
};

export function neighborhoodT(
  key: NeighborhoodCopyKey,
  locale: PaltaLocale,
): string {
  const translated = CATALOGS[locale][key];
  return translated?.trim() ? translated : NEIGHBORHOOD_ES[key];
}
