import { DEFAULT_LOCALE, type PaltaLocale } from './locales.js';

export type TranslationStatus = 'draft' | 'machine' | 'reviewed' | 'approved';

export interface ContentTranslation {
  text: string;
  status?: TranslationStatus;
}

export interface LocalizedContent {
  original: string;
  sourceLocale?: PaltaLocale;
  translations?: Partial<Record<PaltaLocale, ContentTranslation | string>>;
}

export interface ResolvedContent {
  text: string;
  locale: PaltaLocale;
  usedFallback: boolean;
  isOriginal: boolean;
  translationStatus?: TranslationStatus;
}

function translationValue(value: ContentTranslation | string | undefined): ContentTranslation | null {
  if (typeof value === 'string') return value.trim() ? { text: value } : null;
  if (!value?.text.trim()) return null;
  return value;
}

export function hasTranslation(content: LocalizedContent, locale: PaltaLocale): boolean {
  return translationValue(content.translations?.[locale]) !== null;
}

export function resolveLocalizedContent(content: LocalizedContent, preferredLocale: PaltaLocale): ResolvedContent {
  const sourceLocale = content.sourceLocale ?? DEFAULT_LOCALE;

  if (preferredLocale === sourceLocale) {
    return {
      text: content.original,
      locale: sourceLocale,
      usedFallback: false,
      isOriginal: true,
    };
  }

  const translated = translationValue(content.translations?.[preferredLocale]);
  if (translated) {
    return {
      text: translated.text,
      locale: preferredLocale,
      usedFallback: false,
      isOriginal: false,
      ...(translated.status ? { translationStatus: translated.status } : {}),
    };
  }

  return {
    text: content.original,
    locale: sourceLocale,
    usedFallback: true,
    isOriginal: true,
  };
}
