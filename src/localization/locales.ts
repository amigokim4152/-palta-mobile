export const SUPPORTED_LOCALES = ['es-CL', 'ko', 'en', 'zh-Hans'] as const;

export type PaltaLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE = 'es-CL' as const;
export const DEFAULT_REGION = 'CL' as const;
export const DEFAULT_TIMEZONE = 'America/Santiago' as const;
export const DEFAULT_CURRENCY = 'CLP' as const;

export interface LanguageContext {
  preferredLocale: PaltaLocale;
  region: typeof DEFAULT_REGION;
  timezone: typeof DEFAULT_TIMEZONE;
  currency: typeof DEFAULT_CURRENCY;
}

export const DEFAULT_LANGUAGE_CONTEXT: LanguageContext = {
  preferredLocale: DEFAULT_LOCALE,
  region: DEFAULT_REGION,
  timezone: DEFAULT_TIMEZONE,
  currency: DEFAULT_CURRENCY,
};

export function isSupportedLocale(value: string): value is PaltaLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function tryNormalizeLocale(value: string | null | undefined): PaltaLocale | null {
  if (!value) return null;

  const normalized = value.trim().replace('_', '-').toLowerCase();
  if (normalized === 'es' || normalized.startsWith('es-')) return 'es-CL';
  if (normalized === 'ko' || normalized.startsWith('ko-')) return 'ko';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';

  if (
    normalized === 'zh' ||
    normalized === 'zh-hans' ||
    normalized.startsWith('zh-cn') ||
    normalized.startsWith('zh-sg')
  ) {
    return 'zh-Hans';
  }

  return null;
}

export function resolveInitialLocale(deviceLocales: readonly string[]): PaltaLocale {
  for (const locale of deviceLocales) {
    const supported = tryNormalizeLocale(locale);
    if (supported) return supported;
  }

  return DEFAULT_LOCALE;
}

export function createLanguageContext(preferredLocale: PaltaLocale): LanguageContext {
  return {
    ...DEFAULT_LANGUAGE_CONTEXT,
    preferredLocale,
  };
}
