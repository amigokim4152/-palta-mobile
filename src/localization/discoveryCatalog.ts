import type { PaltaLocale } from './locales.js';

export const DISCOVERY_ES = {
  'common.explore': 'Explorar',
  'common.publish': 'Publicar',
  'market.title': 'Mercado',
  'market.subtitle': 'Explorar primero. Publicar dentro de cada categoría.',
  'market.mapUseful': 'Lista y mapa cuando la ubicación realmente ayuda.',
  'market.listOnly': 'Lista simple: el mapa no se fuerza si no aporta.',
  'market.invalidCategory': 'Categoría no válida.',
  'market.publishIn': 'Publicar en {category}',
  'market.exploreCategory': 'Explorar {category}',
  'market.createSubtitle': 'El formulario será específico de esta categoría; no existe un “publicar” genérico.',
  'market.mapSubtitle': 'Esta categoría puede usar el Map Core sin crear otro mapa.',
  'market.listSubtitle': 'Esta categoría prioriza lista y búsqueda.',
  'market.contractPending': 'El contrato de datos del vertical todavía no está conectado. Esta pantalla define la entrada correcta sin inventar publicaciones.',
  'market.vertical.secondhand': 'Usados',
  'market.vertical.vehicles': 'Vehículos',
  'market.vertical.property': 'Propiedades',
  'market.vertical.jobs_services': 'Empleos y servicios',
  'play.title': 'Panoramas',
  'play.subtitle': 'Qué hacer con tu tiempo',
  'play.eatDrinkTitle': 'Comer y tomar algo',
  'play.eatDrinkSubtitle': 'Lugares cercanos y útiles, no un catálogo infinito.',
  'play.eventsCultureTitle': 'Eventos y cultura',
  'play.eventsCultureSubtitle': 'Qué pasa hoy o próximamente cerca de ti.',
  'play.familyTitle': 'Familia',
  'play.familySubtitle': 'Panoramas adecuados al momento y al contexto.',
  'play.travelStaysTitle': 'Viajes y estadías',
  'play.travelStaysSubtitle': 'Explorar. Si el viaje se vuelve real, Palta crea un contexto temporal.',
} as const;

export type DiscoveryKey = keyof typeof DISCOVERY_ES;
export type DiscoveryInterpolation = Record<string, string | number>;
type DiscoveryCatalog = Partial<Record<DiscoveryKey, string>>;

const KO: DiscoveryCatalog = {
  'common.explore': '둘러보기',
  'common.publish': '등록하기',
  'market.title': '마켓',
  'market.subtitle': '먼저 둘러보고, 등록은 각 카테고리 안에서 진행합니다.',
  'market.mapUseful': '위치가 실제로 도움이 되는 경우 목록과 지도를 함께 사용합니다.',
  'market.listOnly': '지도보다 목록과 검색이 더 적합한 카테고리입니다.',
  'market.invalidCategory': '올바르지 않은 카테고리입니다.',
  'market.publishIn': '{category}에 등록하기',
  'market.exploreCategory': '{category} 둘러보기',
  'market.createSubtitle': '등록 양식은 카테고리별로 다르게 구성합니다. 모든 항목에 같은 등록 양식을 쓰지 않습니다.',
  'market.mapSubtitle': '이 카테고리는 별도 지도를 만들지 않고 기존 Map Core를 사용합니다.',
  'market.listSubtitle': '이 카테고리는 목록과 검색을 우선합니다.',
  'market.contractPending': '이 카테고리의 데이터 계약은 아직 연결 전입니다. 가짜 게시물을 만들지 않고 올바른 진입 구조만 먼저 연결했습니다.',
  'market.vertical.secondhand': '중고거래',
  'market.vertical.vehicles': '차량',
  'market.vertical.property': '부동산',
  'market.vertical.jobs_services': '일자리·서비스',
  'play.title': '즐길거리',
  'play.subtitle': '내 시간을 어떻게 보낼지',
  'play.eatDrinkTitle': '먹고 마시기',
  'play.eatDrinkSubtitle': '끝없는 목록이 아니라 가까이에서 실제로 갈 만한 곳을 보여줍니다.',
  'play.eventsCultureTitle': '행사·문화',
  'play.eventsCultureSubtitle': '오늘 또는 가까운 시일에 주변에서 열리는 일을 확인합니다.',
  'play.familyTitle': '가족',
  'play.familySubtitle': '시간과 상황에 맞는 가족 활동을 보여줍니다.',
  'play.travelStaysTitle': '여행·숙박',
  'play.travelStaysSubtitle': '먼저 둘러보고, 여행이 실제 일정이 되면 Palta가 임시 여행 문맥을 만듭니다.',
};

const EN: DiscoveryCatalog = {
  'common.explore': 'Explore',
  'common.publish': 'Post',
  'market.title': 'Market',
  'market.subtitle': 'Explore first. Post inside the relevant category.',
  'market.mapUseful': 'Use a list and map when location genuinely helps.',
  'market.listOnly': 'Use a simple list when a map adds little value.',
  'market.invalidCategory': 'Invalid category.',
  'market.publishIn': 'Post in {category}',
  'market.exploreCategory': 'Explore {category}',
  'market.createSubtitle': 'The form is specific to this category; there is no one generic posting form.',
  'market.mapSubtitle': 'This category can use Map Core without creating another map.',
  'market.listSubtitle': 'This category prioritizes list and search.',
  'market.contractPending': 'The data contract for this vertical is not connected yet. This screen defines the correct entry point without inventing listings.',
  'market.vertical.secondhand': 'Secondhand',
  'market.vertical.vehicles': 'Vehicles',
  'market.vertical.property': 'Property',
  'market.vertical.jobs_services': 'Jobs and services',
  'play.title': 'Things to do',
  'play.subtitle': 'What to do with your time',
  'play.eatDrinkTitle': 'Eat and drink',
  'play.eatDrinkSubtitle': 'Nearby, useful places instead of an endless catalog.',
  'play.eventsCultureTitle': 'Events and culture',
  'play.eventsCultureSubtitle': 'What is happening today or soon near you.',
  'play.familyTitle': 'Family',
  'play.familySubtitle': 'Activities suited to the moment and context.',
  'play.travelStaysTitle': 'Travel and stays',
  'play.travelStaysSubtitle': 'Explore first. If the trip becomes real, Palta creates a temporary travel context.',
};

const ZH_HANS: DiscoveryCatalog = {
  'common.explore': '浏览',
  'common.publish': '发布',
  'market.title': '市场',
  'market.subtitle': '先浏览，再在对应分类中发布。',
  'market.mapUseful': '只有位置真正有帮助时才同时使用列表和地图。',
  'market.listOnly': '地图帮助不大时使用简洁列表。',
  'market.invalidCategory': '分类无效。',
  'market.publishIn': '在{category}中发布',
  'market.exploreCategory': '浏览{category}',
  'market.createSubtitle': '发布表单会按分类定制，不使用统一的通用发布表单。',
  'market.mapSubtitle': '此分类可以直接使用 Map Core，无需另建地图。',
  'market.listSubtitle': '此分类优先使用列表和搜索。',
  'market.contractPending': '此分类的数据契约尚未连接。当前页面只建立正确入口，不生成虚假信息。',
  'market.vertical.secondhand': '二手',
  'market.vertical.vehicles': '车辆',
  'market.vertical.property': '房产',
  'market.vertical.jobs_services': '工作与服务',
  'play.title': '活动',
  'play.subtitle': '如何安排你的时间',
  'play.eatDrinkTitle': '餐饮',
  'play.eatDrinkSubtitle': '展示附近真正有用的地点，而不是无限目录。',
  'play.eventsCultureTitle': '活动与文化',
  'play.eventsCultureSubtitle': '查看今天或近期你附近发生的活动。',
  'play.familyTitle': '家庭',
  'play.familySubtitle': '根据时间和情境推荐合适的家庭活动。',
  'play.travelStaysTitle': '旅行与住宿',
  'play.travelStaysSubtitle': '先浏览；当旅行成为实际计划时，Palta 会创建临时旅行情境。',
};

const CATALOGS: Record<PaltaLocale, DiscoveryCatalog> = {
  'es-CL': DISCOVERY_ES,
  ko: KO,
  en: EN,
  'zh-Hans': ZH_HANS,
};

function interpolate(template: string, values?: DiscoveryInterpolation): string {
  if (!values) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

export function discoveryT(
  key: DiscoveryKey,
  locale: PaltaLocale,
  values?: DiscoveryInterpolation,
): string {
  const translated = CATALOGS[locale][key];
  return interpolate(translated?.trim() ? translated : DISCOVERY_ES[key], values);
}
