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
  return value.length >= 16 ? value.slice(0, 16) : value;
}

function eventFingerprint(item: PlayDiscoveryItem): string {
  return [
    'event',
    item.contentKind,
    normalize(item.title),
    normalize(item.comuna),
    normalize(item.venue),
    minuteKey(item.startAt),
  ].join(':');
}

function offeringKey(item: PlayDiscoveryItem): string | undefined {
  const offeringId = item.offeringId ?? item.businessProjection?.offeringId;
  if (offeringId) return `offering:${offeringId}`;
  const businessId = item.businessProjection?.businessId ?? item.businessId;
  if (!businessId || item.eventId) return undefined;
  return `business:${businessId}:kind:${item.contentKind}`;
}

/**
 * Conservative cross-source identity. Events use title+venue+exact minute so the
 * same show discovered from municipality/venue/ticketing can merge while distinct
 * showtimes remain separate. Offerings keep their canonical offering identity.
 */
export function playCanonicalKey(item: PlayDiscoveryItem): string {
  if (item.canonicalKey?.trim()) return item.canonicalKey.trim();
  if (item.eventId || item.startAt) return eventFingerprint(item);

  const canonicalOffering = offeringKey(item);
  if (canonicalOffering) return canonicalOffering;
  if (item.placeId?.trim()) return `place:${item.placeId.trim()}:kind:${item.contentKind}`;

  return [
    'play',
    item.contentKind,
    normalize(item.title),
    normalize(item.comuna),
    normalize(item.venue),
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

function minimumMetric(
  items: readonly PlayDiscoveryItem[],
  selector: (item: PlayDiscoveryItem) => number | undefined,
): number | undefined {
  const values = items.map(selector).filter((value): value is number => value !== undefined && Number.isFinite(value));
  return values.length ? Math.min(...values) : undefined;
}

export function mergePlayDiscoveryGroup(items: readonly PlayDiscoveryItem[]): PlayDiscoveryItem {
  if (!items.length) throw new Error('play_canonical_group_empty');
  const preferred = preferredItem(items);
  const key = playCanonicalKey(preferred);
  const allSources = uniqueSources(items.flatMap((item) => [item.source, ...(item.alternateSources ?? [])]));
  const allActions = uniqueActions(items.flatMap((item) => [
    ...(item.primaryAction ? [item.primaryAction] : []),
    ...(item.alternateActions ?? []),
  ]));
  const primaryAction = preferred.primaryAction ?? allActions[0];
  const alternateActions = primaryAction
    ? allActions.filter((action) => actionIdentity(action) !== actionIdentity(primaryAction))
    : allActions;
  const travelTimeMinutes = minimumMetric(items, (item) => item.travelTimeMinutes);
  const distanceM = minimumMetric(items, (item) => item.distanceM);
  const nearest = travelTimeMinutes !== undefined
    ? items.find((item) => item.travelTimeMinutes === travelTimeMinutes)
    : distanceM !== undefined
      ? items.find((item) => item.distanceM === distanceM)
      : undefined;

  return {
    ...preferred,
    canonicalKey: key,
    eventId: preferred.eventId ?? items.find((item) => item.eventId)?.eventId,
    venueId: preferred.venueId ?? items.find((item) => item.venueId)?.venueId,
    offeringId: preferred.offeringId ?? items.find((item) => item.offeringId)?.offeringId,
    organizerIds: uniqueStrings(items.flatMap((item) => item.organizerIds ?? [])),
    themeTags: uniqueStrings(items.flatMap((item) => item.themeTags)) as PlayDiscoveryItem['themeTags'],
    experienceTags: uniqueStrings(items.flatMap((item) => item.experienceTags ?? [])),
    isFree: items.some((item) => item.isFree === true) ? true : preferred.isFree,
    registrationRequired: items.some((item) => item.registrationRequired === true) ? true : preferred.registrationRequired,
    ...(preferred.imageUrl ?? items.find((item) => item.imageUrl)?.imageUrl
      ? { imageUrl: preferred.imageUrl ?? items.find((item) => item.imageUrl)?.imageUrl }
      : {}),
    ...(travelTimeMinutes !== undefined ? { travelTimeMinutes } : {}),
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

export function canonicalizePlayDiscoveryItems(items: readonly PlayDiscoveryItem[]): PlayDiscoveryItem[] {
  const groups = new Map<string, PlayDiscoveryItem[]>();
  for (const item of items) {
    const key = playCanonicalKey(item);
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }
  return [...groups.values()].map(mergePlayDiscoveryGroup);
}
