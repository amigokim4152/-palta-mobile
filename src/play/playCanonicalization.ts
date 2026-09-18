import type {
  PlayDiscoveryAction,
  PlayDiscoveryItem,
  PlayDiscoverySource,
} from './playDiscovery.js';

function normalize(value?: string): string {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('es-CL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '-');
}

function minuteKey(value?: string): string {
  if (!value) return 'unscheduled';
  // Preserve minute precision so repeated cinema/performance sessions never collapse.
  return value.length >= 16 ? value.slice(0, 16) : value;
}

function businessKey(item: PlayDiscoveryItem): string | undefined {
  const businessId = item.businessProjection?.businessId ?? item.businessId;
  if (!businessId) return undefined;
  const offeringId = item.businessProjection?.offeringId;
  return offeringId
    ? `business:${businessId}:offering:${offeringId}`
    : `business:${businessId}:kind:${item.contentKind}`;
}

/**
 * Conservative identity used only when an upstream canonical key is unavailable.
 * Exact minute + venue are included intentionally: two screenings of the same film
 * at 18:00 and 20:00 must stay separate user choices.
 */
export function playCanonicalKey(item: PlayDiscoveryItem): string {
  if (item.canonicalKey?.trim()) return item.canonicalKey.trim();

  const canonicalBusiness = businessKey(item);
  if (canonicalBusiness) return canonicalBusiness;
  if (item.placeId?.trim()) return `place:${item.placeId.trim()}:kind:${item.contentKind}`;

  return [
    'play',
    item.contentKind,
    normalize(item.title),
    normalize(item.comuna),
    normalize(item.venue),
    minuteKey(item.startAt),
  ].join(':');
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function actionIdentity(action: PlayDiscoveryAction): string {
  return `${action.kind}:${action.url}`;
}

function uniqueActions(actions: readonly PlayDiscoveryAction[]): PlayDiscoveryAction[] {
  const seen = new Set<string>();
  const result: PlayDiscoveryAction[] = [];
  for (const action of actions) {
    const key = actionIdentity(action);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(action);
  }
  return result;
}

function sourceIdentity(source: PlayDiscoverySource): string {
  return `${normalize(source.authority)}:${source.sourceUrl ?? ''}`;
}

function uniqueSources(sources: readonly PlayDiscoverySource[]): PlayDiscoverySource[] {
  const seen = new Set<string>();
  const result: PlayDiscoverySource[] = [];
  for (const source of sources) {
    const key = sourceIdentity(source);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function provenanceRank(item: PlayDiscoveryItem): number {
  if (item.sourceKind === 'business' && item.businessProjection?.ownerManaged) return 0;
  if (item.sourceKind === 'municipal_event' || item.sourceKind === 'public_program') return 1;
  if (item.sourceKind === 'business') return 2;
  if (item.sourceKind === 'partner_feed') return 3;
  if (item.sourceKind === 'place') return 4;
  return 5;
}

function preferredItem(items: readonly PlayDiscoveryItem[]): PlayDiscoveryItem {
  return [...items].sort((left, right) => {
    const provenance = provenanceRank(left) - provenanceRank(right);
    if (provenance !== 0) return provenance;
    if (Boolean(left.imageUrl) !== Boolean(right.imageUrl)) return left.imageUrl ? -1 : 1;
    if (Boolean(left.primaryAction) !== Boolean(right.primaryAction)) return left.primaryAction ? -1 : 1;
    return left.id.localeCompare(right.id);
  })[0] as PlayDiscoveryItem;
}

function smallestDistance(items: readonly PlayDiscoveryItem[]): number | undefined {
  const values = items
    .map((item) => item.distanceM)
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
  return values.length ? Math.min(...values) : undefined;
}

/**
 * Merge exact cross-source duplicates without flattening genuinely different
 * sessions/offerings. All provenance and operational actions remain available.
 */
export function mergePlayDiscoveryGroup(items: readonly PlayDiscoveryItem[]): PlayDiscoveryItem {
  if (!items.length) throw new Error('play_canonical_group_empty');
  const preferred = preferredItem(items);
  const key = playCanonicalKey(preferred);
  const allSources = uniqueSources(
    items.flatMap((item) => [item.source, ...(item.alternateSources ?? [])]),
  );
  const allActions = uniqueActions(
    items.flatMap((item) => [
      ...(item.primaryAction ? [item.primaryAction] : []),
      ...(item.alternateActions ?? []),
    ]),
  );
  const primaryAction = preferred.primaryAction ?? allActions[0];
  const alternateActions = primaryAction
    ? allActions.filter((action) => actionIdentity(action) !== actionIdentity(primaryAction))
    : allActions;
  const distanceM = smallestDistance(items);
  const nearest = distanceM === undefined
    ? undefined
    : items.find((item) => item.distanceM === distanceM);

  return {
    ...preferred,
    canonicalKey: key,
    themeTags: uniqueStrings(items.flatMap((item) => item.themeTags)) as PlayDiscoveryItem['themeTags'],
    experienceTags: uniqueStrings(items.flatMap((item) => item.experienceTags ?? [])),
    isFree: items.some((item) => item.isFree === true) ? true : preferred.isFree,
    registrationRequired: items.some((item) => item.registrationRequired === true)
      ? true
      : preferred.registrationRequired,
    ...(preferred.imageUrl ?? items.find((item) => item.imageUrl)?.imageUrl
      ? { imageUrl: preferred.imageUrl ?? items.find((item) => item.imageUrl)?.imageUrl }
      : {}),
    ...(distanceM !== undefined ? { distanceM } : {}),
    ...(nearest?.distanceLabel ? { distanceLabel: nearest.distanceLabel } : {}),
    ...(primaryAction ? { primaryAction } : {}),
    ...(alternateActions.length ? { alternateActions } : {}),
    source: preferred.source,
    ...(allSources.length > 1
      ? { alternateSources: allSources.filter((source) => sourceIdentity(source) !== sourceIdentity(preferred.source)) }
      : {}),
  };
}

export function canonicalizePlayDiscoveryItems(
  items: readonly PlayDiscoveryItem[],
): PlayDiscoveryItem[] {
  const groups = new Map<string, PlayDiscoveryItem[]>();
  for (const item of items) {
    const key = playCanonicalKey(item);
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }

  return [...groups.values()].map(mergePlayDiscoveryGroup);
}
