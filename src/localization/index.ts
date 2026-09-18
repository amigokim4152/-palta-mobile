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
  CARE_ES,
  careIntentLabel,
  careT,
  careWaitingForLabel,
  type CareCopyKey,
  type CareInterpolation,
} from './careCatalog.js';

export {
  SURFACE_ES,
  surfaceT,
  type SurfaceInterpolation,
  type SurfaceKey,
} from './surfaceCatalog.js';

export {
  businessCapabilityLabel,
  businessVerificationLabel,
} from './businessCatalog.js';

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
  resolveSignedInLocalePreference,
  updateLocalePreference,
  type LocalePreferenceInput,
  type LocalePreferenceRecord,
  type SignedInLocaleResolution,
  type SignedInLocaleResolutionInput,
} from './preference.js';
