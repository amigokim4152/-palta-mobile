import {
  isPublicPlayItem,
  selectPlayDiscoveryItems,
  validatePlayDiscoveryItem,
  type PlayDiscoveryContext,
  type PlayDiscoveryItem,
  type PlayThemeKey,
} from './playDiscovery.js';

export type PlayFeedSectionKey =
  | 'today_public'
  | 'selected_theme'
  | 'weekend_public'
  | 'birthday';

export type PlayFeedSection = Readonly<{
  key: PlayFeedSectionKey;
  theme: PlayThemeKey;
  items: readonly PlayDiscoveryItem[];
}>;

export type PlayFeed = Readonly<{
  todayPublic: PlayFeedSection;
  selectedTheme?: PlayFeedSection;
  weekendPublic: PlayFeedSection;
  birthday: PlayFeedSection;
}>;

function businessIdentity(item: PlayDiscoveryItem): string | undefined {
  const businessId = item.businessProjection?.businessId ?? item.businessId;
  if (!businessId) return undefined;
  return `${businessId}:${item.businessProjection?.offeringId ?? item.id}`;
}

function dedupeItems(items: readonly PlayDiscoveryItem[]): PlayDiscoveryItem[] {
  const seen = new Set<string>();
  const result: PlayDiscoveryItem[] = [];

  for (const item of items) {
    if (validatePlayDiscoveryItem(item).length) continue;
    const identity = businessIdentity(item) ?? `${item.sourceKind}:${item.id}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(item);
  }
  return result;
}

function discoveryContext(
  theme: PlayThemeKey,
  locality?: string,
): PlayDiscoveryContext {
  return {
    selectedTheme: theme,
    ...(locality ? { locality } : {}),
  };
}

function selectPublic(
  items: readonly PlayDiscoveryItem[],
  theme: PlayThemeKey,
  locality?: string,
  limit = 8,
): PlayDiscoveryItem[] {
  return dedupeItems(
    selectPlayDiscoveryItems(items, discoveryContext(theme, locality)).filter(isPublicPlayItem),
  ).slice(0, limit);
}

function selectTheme(
  items: readonly PlayDiscoveryItem[],
  theme: PlayThemeKey,
  locality?: string,
  limit = 12,
): PlayDiscoveryItem[] {
  return dedupeItems(
    selectPlayDiscoveryItems(items, discoveryContext(theme, locality)),
  ).slice(0, limit);
}

export function composePlayFeed(input: {
  items: readonly PlayDiscoveryItem[];
  locality?: string;
  selectedTheme?: PlayThemeKey;
}): PlayFeed {
  const selectedTheme = input.selectedTheme ?? 'today';
  const todayPublic: PlayFeedSection = {
    key: 'today_public',
    theme: 'today',
    items: selectPublic(input.items, 'today', input.locality),
  };
  const weekendPublic: PlayFeedSection = {
    key: 'weekend_public',
    theme: 'weekend',
    items: selectPublic(input.items, 'weekend', input.locality, 6),
  };
  const birthday: PlayFeedSection = {
    key: 'birthday',
    theme: 'birthday',
    items: selectTheme(input.items, 'birthday', input.locality, 6),
  };

  const selected = selectedTheme === 'today'
    ? undefined
    : {
        key: 'selected_theme' as const,
        theme: selectedTheme,
        items: selectTheme(input.items, selectedTheme, input.locality),
      };

  return {
    todayPublic,
    ...(selected ? { selectedTheme: selected } : {}),
    weekendPublic,
    birthday,
  };
}
