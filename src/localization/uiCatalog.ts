import { DEFAULT_LOCALE, type PaltaLocale } from './locales.js';

export const ES_CL_UI = {
  'nav.home': 'Inicio',
  'nav.neighborhood': 'Barrio',
  'nav.community': 'Comunidad',
  'nav.market': 'Mercado',
  'nav.play': 'Panoramas',
  'nav.businesses': 'Negocios',
  'common.language': 'Idioma',
  'common.settings': 'Configuración',
  'common.back': 'Volver',
  'common.retry': 'Intentar de nuevo',
  'common.processing': 'Procesando…',
  'auth.checkingSession': 'Comprobando tu sesión…',
  'auth.signInOrSignUp': 'Inicia sesión o crea una cuenta',
  'auth.continueApple': 'Continuar con Apple',
  'auth.continueGoogle': 'Continuar con Google',
  'auth.email': 'Correo electrónico',
  'auth.sendEmailLink': 'Enviar enlace por correo',
  'auth.emailLinkSent': 'Enviamos un enlace de acceso a',
  'auth.openSameDevice': 'Abre el enlace en este dispositivo para volver a Palta.',
  'auth.signOut': 'Cerrar sesión',
  'settings.language': 'Idioma',
  'settings.languageDescription': 'Elige el idioma de Palta. Si una traducción no existe, verás el original en español.',
} as const;

export type UiKey = keyof typeof ES_CL_UI;
type UiCatalog = Partial<Record<UiKey, string>>;

const KO_UI: UiCatalog = {
  'nav.home': '홈',
  'nav.neighborhood': '동네',
  'nav.community': '커뮤니티',
  'nav.market': '마켓',
  'nav.play': '즐길거리',
  'nav.businesses': '동네업체',
  'common.language': '언어',
  'common.settings': '설정',
  'common.back': '뒤로',
  'common.retry': '다시 시도',
  'common.processing': '처리 중…',
  'auth.checkingSession': '로그인 상태를 확인하고 있습니다.',
  'auth.signInOrSignUp': '로그인 또는 회원가입',
  'auth.continueApple': 'Apple로 계속',
  'auth.continueGoogle': 'Google로 계속',
  'auth.email': '이메일',
  'auth.sendEmailLink': '이메일 링크 보내기',
  'auth.emailLinkSent': '로그인 링크를 보냈습니다:',
  'auth.openSameDevice': '같은 기기에서 링크를 열면 Palta로 돌아옵니다.',
  'auth.signOut': '로그아웃',
  'settings.language': '언어',
  'settings.languageDescription': 'Palta에서 사용할 언어를 선택하세요. 번역이 없는 내용은 스페인어 원문으로 표시됩니다.',
};

const EN_UI: UiCatalog = {
  'nav.home': 'Home',
  'nav.neighborhood': 'Neighborhood',
  'nav.community': 'Community',
  'nav.market': 'Market',
  'nav.play': 'Things to do',
  'nav.businesses': 'Businesses',
  'common.language': 'Language',
  'common.settings': 'Settings',
  'common.back': 'Back',
  'common.retry': 'Try again',
  'common.processing': 'Processing…',
  'auth.checkingSession': 'Checking your sign-in status…',
  'auth.signInOrSignUp': 'Sign in or create an account',
  'auth.continueApple': 'Continue with Apple',
  'auth.continueGoogle': 'Continue with Google',
  'auth.email': 'Email',
  'auth.sendEmailLink': 'Send email link',
  'auth.emailLinkSent': 'We sent a sign-in link to',
  'auth.openSameDevice': 'Open the link on this device to return to Palta.',
  'auth.signOut': 'Sign out',
  'settings.language': 'Language',
  'settings.languageDescription': 'Choose the language Palta uses. If a translation is unavailable, the Spanish original is shown.',
};

const ZH_HANS_UI: UiCatalog = {
  'nav.home': '首页',
  'nav.neighborhood': '附近',
  'nav.community': '社区',
  'nav.market': '市场',
  'nav.play': '活动',
  'nav.businesses': '商家',
  'common.language': '语言',
  'common.settings': '设置',
  'common.back': '返回',
  'common.retry': '重试',
  'common.processing': '处理中…',
  'auth.checkingSession': '正在检查登录状态…',
  'auth.signInOrSignUp': '登录或注册',
  'auth.continueApple': '使用 Apple 继续',
  'auth.continueGoogle': '使用 Google 继续',
  'auth.email': '电子邮箱',
  'auth.sendEmailLink': '发送邮箱登录链接',
  'auth.emailLinkSent': '登录链接已发送至',
  'auth.openSameDevice': '请在此设备上打开链接以返回 Palta。',
  'auth.signOut': '退出登录',
  'settings.language': '语言',
  'settings.languageDescription': '选择 Palta 的显示语言。没有翻译时，将显示西班牙语原文。',
};

const CATALOGS: Record<PaltaLocale, UiCatalog> = {
  'es-CL': ES_CL_UI,
  ko: KO_UI,
  en: EN_UI,
  'zh-Hans': ZH_HANS_UI,
};

export interface UiTranslationResult {
  text: string;
  locale: PaltaLocale;
  usedFallback: boolean;
}

export function resolveUiText(key: UiKey, locale: PaltaLocale): UiTranslationResult {
  const translated = CATALOGS[locale][key];
  if (translated?.trim()) return { text: translated, locale, usedFallback: false };
  return { text: ES_CL_UI[key], locale: DEFAULT_LOCALE, usedFallback: locale !== DEFAULT_LOCALE };
}

export function t(key: UiKey, locale: PaltaLocale): string {
  return resolveUiText(key, locale).text;
}
