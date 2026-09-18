export const playThemeKeys = [
  'today',
  'weekend',
  'family',
  'free',
  'outdoor',
  'birthday',
] as const;

export type PlayThemeKey = (typeof playThemeKeys)[number];

export type PlaySourceKind =
  | 'municipal_event'
  | 'public_program'
  | 'place'
  | 'business';

export type PlayDiscoverySource = {
  authority: string;
  sourceUrl?: string;
  verifiedAt?: string;
};

export type PlayDiscoveryItem = {
  id: string;
  sourceKind: PlaySourceKind;
  title: string;
  comuna: string;
  venue?: string;
  scheduleLabel: string;
  startAt?: string;
  endAt?: string;
  isFree?: boolean;
  registrationRequired?: boolean;
  audienceLabel?: string;
  themeTags: PlayThemeKey[];
  placeId?: string;
  businessId?: string;
  source: PlayDiscoverySource;
};

export type PlayDiscoveryContext = {
  locality?: string;
  selectedTheme?: PlayThemeKey;
};

export function isPublicPlayItem(item: PlayDiscoveryItem): boolean {
  return (
    item.sourceKind === 'municipal_event' ||
    item.sourceKind === 'public_program'
  );
}

export function matchesPlayTheme(
  item: PlayDiscoveryItem,
  theme: PlayThemeKey,
): boolean {
  if (theme === 'free' && item.isFree) return true;
  return item.themeTags.includes(theme);
}

export function selectPlayDiscoveryItems(
  items: readonly PlayDiscoveryItem[],
  context: PlayDiscoveryContext = {},
): PlayDiscoveryItem[] {
  const filtered = context.selectedTheme
    ? items.filter((item) =>
        matchesPlayTheme(item, context.selectedTheme as PlayThemeKey),
      )
    : [...items];

  return filtered.sort((left, right) => {
    const leftLocal =
      context.locality && left.comuna === context.locality ? 0 : 1;
    const rightLocal =
      context.locality && right.comuna === context.locality ? 0 : 1;

    if (leftLocal !== rightLocal) return leftLocal - rightLocal;

    const leftPublic = isPublicPlayItem(left) ? 0 : 1;
    const rightPublic = isPublicPlayItem(right) ? 0 : 1;

    if (leftPublic !== rightPublic) return leftPublic - rightPublic;

    if (left.startAt && right.startAt) {
      const dateOrder = left.startAt.localeCompare(right.startAt);
      if (dateOrder !== 0) return dateOrder;
    } else if (left.startAt) {
      return -1;
    } else if (right.startAt) {
      return 1;
    }

    return left.title.localeCompare(right.title, 'es');
  });
}
