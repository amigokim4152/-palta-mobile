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

export interface SignedInLocaleResolutionInput {
  remoteLocale?: string | null;
  remoteExplicit?: boolean;
  localExplicitLocale?: string | null;
  deviceLocales?: readonly string[];
}

export interface SignedInLocaleResolution {
  locale: PaltaLocale;
  promoteLocalToAccount: boolean;
}

/**
 * Resolve locale after authentication without conflating a database default
 * with an actual user choice. A local locale exists only after the user
 * explicitly selected it on this device, so it is safe to promote when the
 * account has no explicit preference yet.
 */
export function resolveSignedInLocalePreference(
  input: SignedInLocaleResolutionInput,
): SignedInLocaleResolution {
  if (input.remoteExplicit) {
    const remote = tryNormalizeLocale(input.remoteLocale);
    if (remote) {
      return { locale: remote, promoteLocalToAccount: false };
    }
  }

  const local = tryNormalizeLocale(input.localExplicitLocale);
  if (local) {
    return { locale: local, promoteLocalToAccount: true };
  }

  return {
    locale: resolvePreferredLocale({ deviceLocales: input.deviceLocales }),
    promoteLocalToAccount: false,
  };
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
