import {
  DEFAULT_LOCALE,
  resolveInitialLocale,
  tryNormalizeLocale,
  type PaltaLocale,
} from './locales.js';

export interface LocalePreferenceInput {
  accountLocale?: string | null;
  deviceLocales?: readonly string[];
}

/**
 * Account choice wins. Device locale is only an onboarding/default hint.
 * Unsupported values ultimately fall back to Chilean Spanish.
 */
export function resolvePreferredLocale(input: LocalePreferenceInput): PaltaLocale {
  const accountLocale = tryNormalizeLocale(input.accountLocale);
  if (accountLocale) return accountLocale;

  if (input.deviceLocales && input.deviceLocales.length > 0) {
    return resolveInitialLocale(input.deviceLocales);
  }

  return DEFAULT_LOCALE;
}

export function serializePreferredLocale(locale: PaltaLocale): string {
  return locale;
}
