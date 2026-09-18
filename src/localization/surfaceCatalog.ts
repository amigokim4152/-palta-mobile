import type { PaltaLocale } from './locales.js';

export const SURFACE_ES = {
  'async.loading': 'Cargando…',
  'async.errorTitle': 'No pudimos actualizar esta información.',
  'async.retry': 'Reintentar',
  'search.title': 'Buscar',
  'search.subtitle': 'Una búsqueda, múltiples tipos de resultado',
  'search.scope': 'Lugares · Negocios · Acciones públicas · Eventos · Mercado · Estado personal cuando corresponda',
  'place.title': 'Lugar',
  'place.id': 'Lugar: {id}',
  'context.title': 'Contexto',
  'context.subtitle': 'Contexto temporal · {id}',
  'context.body': 'El contexto temporal de vida o viaje reutiliza entidades canónicas y el estado de Care; no crea un silo nuevo.',
  'map.title': 'Mapa',
  'map.subtitle': 'Map Core compartido',
  'map.body': 'Ruta de mapa contextual. No es una sexta pestaña permanente.',
} as const;

export type SurfaceKey = keyof typeof SURFACE_ES;
export type SurfaceInterpolation = Record<string, string | number>;
type SurfaceCatalog = Partial<Record<SurfaceKey, string>>;

const KO: SurfaceCatalog = {
  'async.loading': '불러오는 중…',
  'async.errorTitle': '이 정보를 업데이트하지 못했습니다.',
  'async.retry': '다시 시도',
  'search.title': '검색',
  'search.subtitle': '한 번의 검색으로 여러 종류의 결과를 찾습니다',
  'search.scope': '장소 · 동네업체 · 공공 서비스 · 행사 · 마켓 · 필요한 경우 개인 상태',
  'place.title': '장소',
  'place.id': '장소: {id}',
  'context.title': '문맥',
  'context.subtitle': '임시 문맥 · {id}',
  'context.body': '여행이나 특정 생활 상황의 임시 문맥은 기존 canonical entity와 Care 상태를 재사용하며 별도 데이터 사일로를 만들지 않습니다.',
  'map.title': '지도',
  'map.subtitle': '공통 Map Core',
  'map.body': '필요한 상황에서 여는 공통 지도 화면입니다. 별도의 여섯 번째 고정 탭이 아닙니다.',
};

const EN: SurfaceCatalog = {
  'async.loading': 'Loading…',
  'async.errorTitle': 'We could not update this information.',
  'async.retry': 'Try again',
  'search.title': 'Search',
  'search.subtitle': 'One search, multiple result types',
  'search.scope': 'Places · Businesses · Public services · Events · Market · Personal state when appropriate',
  'place.title': 'Place',
  'place.id': 'Place: {id}',
  'context.title': 'Context',
  'context.subtitle': 'Temporary context · {id}',
  'context.body': 'A temporary life or travel context reuses canonical entities and Care state; it does not create another silo.',
  'map.title': 'Map',
  'map.subtitle': 'Shared Map Core',
  'map.body': 'A contextual map route. It is not a sixth permanent tab.',
};

const ZH_HANS: SurfaceCatalog = {
  'async.loading': '加载中…',
  'async.errorTitle': '无法更新此信息。',
  'async.retry': '重试',
  'search.title': '搜索',
  'search.subtitle': '一次搜索，多种结果类型',
  'search.scope': '地点 · 商家 · 公共服务 · 活动 · 市场 · 适用时的个人状态',
  'place.title': '地点',
  'place.id': '地点：{id}',
  'context.title': '情境',
  'context.subtitle': '临时情境 · {id}',
  'context.body': '临时生活或旅行情境会复用 canonical entity 和 Care 状态，不会建立新的数据孤岛。',
  'map.title': '地图',
  'map.subtitle': '共享 Map Core',
  'map.body': '这是按情境打开的共享地图页面，不是第六个固定标签页。',
};

const CATALOGS: Record<PaltaLocale, SurfaceCatalog> = {
  'es-CL': SURFACE_ES,
  ko: KO,
  en: EN,
  'zh-Hans': ZH_HANS,
};

function interpolate(template: string, values?: SurfaceInterpolation): string {
  if (!values) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

export function surfaceT(
  key: SurfaceKey,
  locale: PaltaLocale,
  values?: SurfaceInterpolation,
): string {
  const translated = CATALOGS[locale][key];
  return interpolate(translated?.trim() ? translated : SURFACE_ES[key], values);
}
