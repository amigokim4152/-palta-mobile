import {
  DEFAULT_LOCALE,
  resolveInitialLocale,
  tryNormalizeLocale,
  type PaltaLocale,
} from './locales.js';

export interface LocalePreferenceInput {
  storedLocale?: string | null;
  storedLocaleExplicit?: boolean;
  deviceLocales?: readonly string[];
}

export function resolvePreferredLocale(input: LocalePreferenceInput): PaltaLocale {
  if (input.storedLocaleExplicit) {
    const stored = tryNormalizeLocale(input.storedLocale);
    if (stored) return stored;
  }

  if (input.deviceLocales?.length) {
    return resolveInitialLocale(input.deviceLocales);
  }

  return DEFAULT_LOCALE;
}

export interface LocalePreferenceRecord {
  preferredLocale: PaltaLocale;
  explicit: boolean;
  updatedAt?: string;
}

export function updateLocalePreference(
  current: LocalePreferenceRecord,
  preferredLocale: PaltaLocale,
  updatedAt?: string,
): LocalePreferenceRecord {
  return {
    ...current,
    preferredLocale,
    explicit: true,
    ...(updatedAt ? { updatedAt } : {}),
  };
}
