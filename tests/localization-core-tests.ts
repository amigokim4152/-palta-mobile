import {
  DEFAULT_CURRENCY,
  DEFAULT_LOCALE,
  DEFAULT_REGION,
  DEFAULT_TIMEZONE,
  createLanguageContext,
  resolveInitialLocale,
  resolveLocalizedContent,
  resolvePreferredLocale,
  resolveUiText,
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
assert(tryNormalizeLocale('pt-BR') === null, 'Unsupported locale must not silently map to another non-Spanish locale.');
assert(resolveInitialLocale(['pt-BR']) === 'es-CL', 'Unsupported device locale must fall back to Spanish.');
assert(resolveInitialLocale(['pt-BR', 'ko-KR']) === 'ko', 'First supported device locale should be selected.');
assert(resolvePreferredLocale({ accountLocale: 'ko', deviceLocales: ['es-CL'] }) === 'ko', 'Saved account language must win over the device language.');
assert(resolvePreferredLocale({ deviceLocales: ['zh-CN'] }) === 'zh-Hans', 'Device language should seed preference when the account has no saved choice.');
assert(resolvePreferredLocale({ accountLocale: 'pt-BR', deviceLocales: ['en-US'] }) === 'en', 'Unsupported saved values may fall through to a supported device language.');
assert(resolvePreferredLocale({ accountLocale: 'pt-BR', deviceLocales: ['pt-BR'] }) === 'es-CL', 'Unsupported account and device values must fall back to Chilean Spanish.');

assert(t('nav.home', 'ko') === '홈', 'Korean UI copy should be used when available.');
assert(t('nav.home', 'en') === 'Home', 'English UI copy should be used when available.');
assert(t('nav.home', 'zh-Hans') === '首页', 'Simplified Chinese UI copy should be used when available.');

const uiFallback = resolveUiText('system.privacyNotice', 'ko');
assert(uiFallback.text === 'Aviso de privacidad', 'Missing Korean UI copy must fall back to Spanish.');
assert(uiFallback.locale === 'es-CL' && uiFallback.usedFallback, 'UI fallback metadata must report Spanish fallback.');

const content = {
  original: 'Hoy cerramos a las 18:00.',
  sourceLocale: 'es-CL',
  translations: {
    ko: { text: '오늘은 오후 6시에 문을 닫습니다.', status: 'reviewed' as const },
    'zh-Hans': { text: '今天18:00关门。', status: 'machine' as const },
  },
};

const koreanContent = resolveLocalizedContent(content, 'ko');
assert(koreanContent.text === '오늘은 오후 6시에 문을 닫습니다.', 'Existing Korean content translation should be displayed.');
assert(!koreanContent.usedFallback && !koreanContent.isOriginal, 'Translated content must not be marked as fallback/original.');
assert(koreanContent.translationStatus === 'reviewed', 'Translation provenance/status should survive resolution.');

const englishContent = resolveLocalizedContent(content, 'en');
assert(englishContent.text === 'Hoy cerramos a las 18:00.', 'Missing English translation must display the Spanish original.');
assert(englishContent.locale === 'es-CL' && englishContent.usedFallback, 'Missing translation must report Spanish fallback.');

const chineseContent = resolveLocalizedContent(content, 'zh-Hans');
assert(chineseContent.text === '今天18:00关门。', 'Existing Simplified Chinese translation should be displayed.');

const context = createLanguageContext('ko');
assert(context.preferredLocale === 'ko', 'Preferred language should be independently configurable.');
assert(context.region === DEFAULT_REGION && context.region === 'CL', 'Changing language must not change Chile region context.');
assert(context.timezone === DEFAULT_TIMEZONE && context.timezone === 'America/Santiago', 'Changing language must not change Santiago timezone.');
assert(context.currency === DEFAULT_CURRENCY && context.currency === 'CLP', 'Changing language must not change CLP currency context.');

console.log('PASS: localization core tests');
