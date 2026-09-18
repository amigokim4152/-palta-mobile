export const panoramaMenuLabels = {
  es: 'Panorama',
  ko: '즐길거리',
  en: 'Things to do',
  zh: '活动',
} as const;

export type PanoramaLocale = keyof typeof panoramaMenuLabels;

export function panoramaMenuLabel(locale: PanoramaLocale = 'es'): string {
  return panoramaMenuLabels[locale];
}
