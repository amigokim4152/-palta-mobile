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
  ES_CL_UI,
  resolveUiText,
  t,
  type UiInterpolation,
  type UiKey,
  type UiTranslationResult,
} from './uiCatalog.js';

export {
  DISCOVERY_ES,
  discoveryT,
  type DiscoveryInterpolation,
  type DiscoveryKey,
} from './discoveryCatalog.js';

export {
  hasTranslation,
  resolveLocalizedContent,
  type ContentTranslation,
  type LocalizedContent,
  type ResolvedContent,
  type TranslationStatus,
} from './contentResolver.js';

export {
  resolvePreferredLocale,
  updateLocalePreference,
  type LocalePreferenceInput,
  type LocalePreferenceRecord,
} from './preference.js';
