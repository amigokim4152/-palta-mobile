import { careStateLabel } from '../src/care/careTimeline.js';
import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_REGION,
  DEFAULT_TIMEZONE,
  careT,
  createLanguageContext,
  discoveryT,
  resolveLocalizedContent,
  resolvePreferredLocale,
  surfaceT,
  t,
  tryNormalizeLocale,
} from '../src/localization/index.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(DEFAULT_LOCALE === 'es-CL', 'Spanish (Chile) must remain the canonical default locale.');
assert(tryNormalizeLocale('ko-KR') === 'ko', 'Korean device locale should normalize to ko.');
assert(tryNormalizeLocale('en-US') === 'en', 'English device locale should normalize to en.');
assert(tryNormalizeLocale('zh-CN') === 'zh-Hans', 'Simplified Chinese device locale should normalize to zh-Hans.');
assert(tryNormalizeLocale('pt-BR') === null, 'Unsupported locale must not be coerced to another translated locale.');

assert(
  resolvePreferredLocale({ deviceLocales: ['ko-KR'] }) === 'ko',
  'Korean device should see Korean when there is no explicit account preference.',
);
assert(
  resolvePreferredLocale({
    storedLocale: 'es-CL',
    storedLocaleExplicit: false,
    deviceLocales: ['ko-KR'],
  }) === 'ko',
  'Database default Spanish must not override a Korean device before the user explicitly chooses Spanish.',
);
assert(
  resolvePreferredLocale({
    storedLocale: 'es-CL',
    storedLocaleExplicit: true,
    deviceLocales: ['ko-KR'],
  }) === 'es-CL',
  'An explicit account language must override the device language.',
);

assert(t('nav.home', 'ko') === '홈', 'Korean tab label should resolve.');
assert(t('nav.home', 'en') === 'Home', 'English tab label should resolve.');
assert(t('nav.home', 'zh-Hans') === '首页', 'Chinese tab label should resolve.');
assert(t('nav.home', 'es-CL') === 'Inicio', 'Spanish tab label should remain canonical.');
assert(
  t('home.showMore', 'ko', { count: 3 }) === '3개 더 보기',
  'Korean UI interpolation should preserve locale-specific word order.',
);
assert(
  t('home.showMore', 'es-CL', { count: 3 }) === 'Ver 3 más',
  'Spanish UI interpolation should resolve runtime values.',
);
assert(
  discoveryT('market.vertical.property', 'ko') === '부동산',
  'Market vertical labels should resolve through the feature catalog.',
);
assert(
  discoveryT('market.publishIn', 'en', { category: 'Vehicles' }) ===
    'Post in Vehicles',
  'Feature copy should support runtime interpolation.',
);
assert(
  careStateLabel('follow_up', 'zh-Hans') === '后续处理',
  'Care state labels should resolve in Simplified Chinese.',
);
assert(
  careT('care.state', 'ko', { state: '기다리는 중' }) ===
    '현재 상태: 기다리는 중',
  'Care copy should preserve locale-specific interpolation order.',
);
assert(
  surfaceT('context.subtitle', 'ko', { id: 'travel-001' }) ===
    '임시 문맥 · travel-001',
  'Secondary surfaces should share the selected Palta locale.',
);
assert(
  surfaceT('async.retry', 'zh-Hans') === '重试',
  'Shared async controls should not fall back to Spanish when a translation exists.',
);

const content = {
  original: 'Hoy cerramos a las 18:00.',
  sourceLocale: 'es-CL' as const,
  translations: {
    ko: { text: '오늘은 오후 6시에 문을 닫습니다.', status: 'reviewed' as const },
  },
};
assert(
  resolveLocalizedContent(content, 'ko').text === '오늘은 오후 6시에 문을 닫습니다.',
  'Existing requested-language content should be used.',
);
const chineseFallback = resolveLocalizedContent(content, 'zh-Hans');
assert(
  chineseFallback.text === 'Hoy cerramos a las 18:00.' && chineseFallback.usedFallback,
  'Missing translation must fall back directly to the Spanish original.',
);

const koreanContext = createLanguageContext('ko');
assert(koreanContext.region === DEFAULT_REGION && DEFAULT_REGION === 'CL', 'Locale must not change Chile region.');
assert(koreanContext.timezone === DEFAULT_TIMEZONE && DEFAULT_TIMEZONE === 'America/Santiago', 'Locale must not change Santiago timezone.');
assert(koreanContext.currency === DEFAULT_CURRENCY && DEFAULT_CURRENCY === 'CLP', 'Locale must not change CLP currency.');

console.log('PASS: localization runtime tests');
