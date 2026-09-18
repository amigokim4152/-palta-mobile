export {
  DEFAULT_CURRENCY,
  DEFAULT_LANGUAGE_CONTEXT,
  DEFAULT_LOCALE,
  DEFAULT_REGION,
  DEFAULT_TIMEZONE,
  SUPPORTED_LOCALES,
  createLanguageContext,
  isSupportedLocale,
  resolveInitialLocale,
  tryNormalizeLocale,
  type LanguageContext,
  type PaltaLocale,
} from './locales.js';

export {
  resolvePreferredLocale,
  serializePreferredLocale,
  type LocalePreferenceInput,
} from './preference.js';

export {
  ES_CL_UI,
  resolveUiText,
  t,
  type UiKey,
  type UiTranslationResult,
} from './uiCatalog.js';

export {
  hasTranslation,
  resolveLocalizedContent,
  type ContentTranslation,
  type LocalizedContent,
  type ResolvedContent,
  type TranslationStatus,
} from './contentResolver.js';
