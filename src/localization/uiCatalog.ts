import { DEFAULT_LOCALE, type PaltaLocale } from './locales.js';

export const ES_CL_UI = {
  'nav.home': 'Inicio',
  'nav.businesses': 'Negocios',
  'nav.community': 'Comunidad',
  'nav.transport': 'Transporte',
  'nav.profile': 'Perfil',
  'common.save': 'Guardar',
  'common.follow': 'Seguir',
  'common.search': 'Buscar',
  'common.map': 'Mapa',
  'common.call': 'Llamar',
  'common.message': 'Mensaje',
  'common.quote': 'Solicitar cotización',
  'common.settings': 'Configuración',
  'common.language': 'Idioma',
  'common.original': 'Ver original',
  'auth.signIn': 'Iniciar sesión',
  'auth.signUp': 'Crear cuenta',
  'auth.continueWithApple': 'Continuar con Apple',
  'auth.continueWithGoogle': 'Continuar con Google',
  'auth.continueWithEmail': 'Continuar con correo',
  'business.openNow': 'Abierto ahora',
  'business.closed': 'Cerrado',
  'business.hours': 'Horario',
  'system.retry': 'Intentar de nuevo',
  'system.offline': 'Sin conexión',
  'system.privacyNotice': 'Aviso de privacidad',
} as const;

export type UiKey = keyof typeof ES_CL_UI;
type PartialUiCatalog = Partial<Record<UiKey, string>>;

const KO_UI: PartialUiCatalog = {
  'nav.home': '홈',
  'nav.businesses': '동네업체',
  'nav.community': '커뮤니티',
  'nav.transport': '교통',
  'nav.profile': '내 정보',
  'common.save': '저장',
  'common.follow': '팔로우',
  'common.search': '검색',
  'common.map': '지도',
  'common.call': '전화',
  'common.message': '메시지',
  'common.quote': '견적 요청',
  'common.settings': '설정',
  'common.language': '언어',
  'common.original': '원문 보기',
  'auth.signIn': '로그인',
  'auth.signUp': '계정 만들기',
  'auth.continueWithApple': 'Apple로 계속하기',
  'auth.continueWithGoogle': 'Google로 계속하기',
  'auth.continueWithEmail': '이메일로 계속하기',
  'business.openNow': '영업 중',
  'business.closed': '영업 종료',
  'business.hours': '영업시간',
  'system.retry': '다시 시도',
  'system.offline': '오프라인',
};

const EN_UI: PartialUiCatalog = {
  'nav.home': 'Home',
  'nav.businesses': 'Businesses',
  'nav.community': 'Community',
  'nav.transport': 'Transport',
  'nav.profile': 'Profile',
  'common.save': 'Save',
  'common.follow': 'Follow',
  'common.search': 'Search',
  'common.map': 'Map',
  'common.call': 'Call',
  'common.message': 'Message',
  'common.quote': 'Request quote',
  'common.settings': 'Settings',
  'common.language': 'Language',
  'common.original': 'View original',
  'auth.signIn': 'Sign in',
  'auth.signUp': 'Create account',
  'auth.continueWithApple': 'Continue with Apple',
  'auth.continueWithGoogle': 'Continue with Google',
  'auth.continueWithEmail': 'Continue with email',
  'business.openNow': 'Open now',
  'business.closed': 'Closed',
  'business.hours': 'Hours',
  'system.retry': 'Try again',
  'system.offline': 'Offline',
};

const ZH_HANS_UI: PartialUiCatalog = {
  'nav.home': '首页',
  'nav.businesses': '附近商家',
  'nav.community': '社区',
  'nav.transport': '交通',
  'nav.profile': '我的',
  'common.save': '保存',
  'common.follow': '关注',
  'common.search': '搜索',
  'common.map': '地图',
  'common.call': '电话',
  'common.message': '消息',
  'common.quote': '申请报价',
  'common.settings': '设置',
  'common.language': '语言',
  'common.original': '查看原文',
  'auth.signIn': '登录',
  'auth.signUp': '创建账户',
  'auth.continueWithApple': '使用 Apple 继续',
  'auth.continueWithGoogle': '使用 Google 继续',
  'auth.continueWithEmail': '使用邮箱继续',
  'business.openNow': '营业中',
  'business.closed': '已打烊',
  'business.hours': '营业时间',
  'system.retry': '重试',
  'system.offline': '离线',
};

const UI_CATALOGS: Record<Exclude<PaltaLocale, typeof DEFAULT_LOCALE>, PartialUiCatalog> = {
  ko: KO_UI,
  en: EN_UI,
  'zh-Hans': ZH_HANS_UI,
};

export interface UiTranslationResult {
  text: string;
  locale: PaltaLocale;
  usedFallback: boolean;
}

export function resolveUiText(key: UiKey, preferredLocale: PaltaLocale): UiTranslationResult {
  if (preferredLocale === DEFAULT_LOCALE) {
    return { text: ES_CL_UI[key], locale: DEFAULT_LOCALE, usedFallback: false };
  }

  const translated = UI_CATALOGS[preferredLocale][key];
  if (translated && translated.trim().length > 0) {
    return { text: translated, locale: preferredLocale, usedFallback: false };
  }

  return { text: ES_CL_UI[key], locale: DEFAULT_LOCALE, usedFallback: true };
}

export function t(key: UiKey, preferredLocale: PaltaLocale): string {
  return resolveUiText(key, preferredLocale).text;
}
