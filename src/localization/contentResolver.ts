import { DEFAULT_LOCALE, type PaltaLocale } from './locales.js';

export type TranslationStatus = 'machine' | 'reviewed' | 'approved';

export interface ContentTranslation {
  text: string;
  status?: TranslationStatus;
  updatedAt?: string;
}

export interface LocalizedContent {
  original: string;
  sourceLocale?: string;
  translations?: Partial<Record<PaltaLocale, ContentTranslation>>;
}

export interface ResolvedContent {
  text: string;
  locale: string;
  usedFallback: boolean;
  isOriginal: boolean;
  translationStatus?: TranslationStatus;
}

function nonEmpty(text: string | undefined): text is string {
  return typeof text === 'string' && text.trim().length > 0;
}

export function resolveLocalizedContent(
  content: LocalizedContent,
  preferredLocale: PaltaLocale,
): ResolvedContent {
  const sourceLocale = content.sourceLocale ?? DEFAULT_LOCALE;

  if (preferredLocale === sourceLocale) {
    return {
      text: content.original,
      locale: sourceLocale,
      usedFallback: false,
      isOriginal: true,
    };
  }

  const translation = content.translations?.[preferredLocale];
  if (translation && nonEmpty(translation.text)) {
    const result: ResolvedContent = {
      text: translation.text,
      locale: preferredLocale,
      usedFallback: false,
      isOriginal: false,
    };
    if (translation.status) result.translationStatus = translation.status;
    return result;
  }

  return {
    text: content.original,
    locale: sourceLocale,
    usedFallback: true,
    isOriginal: true,
  };
}

export function hasTranslation(content: LocalizedContent, locale: PaltaLocale): boolean {
  const translation = content.translations?.[locale];
  return Boolean(translation && nonEmpty(translation.text));
}
