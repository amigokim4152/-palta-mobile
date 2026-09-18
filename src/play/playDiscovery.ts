import type { PlayContentKind } from './playContentTaxonomy.js';

export const playThemeKeys = [
  'today',
  'weekend',
  'family',
  'couple',
  'free',
  'outdoor',
  'birthday',
] as const;

export type PlayThemeKey = (typeof playThemeKeys)[number];

/** Where the discovery fact/projection came from. This is not what the item is. */
export type PlaySourceKind =
  | 'municipal_event'
  | 'public_program'
  | 'place'
  | 'business'
  | 'partner_feed'
  | 'editorial';

export type PlayDiscoverySource = {
  authority: string;
  sourceUrl?: string;
  verifiedAt?: string;
};

export type PlayDiscoveryActionKind =
  | 'registration'
  | 'ticket'
  | 'reservation'
  | 'official_info';

export type PlayDiscoveryAction = Readonly<{
  kind: PlayDiscoveryActionKind;
  url: string;
  label?: string;
}>;

export type PlayBusinessProjectionRef = Readonly<{
  businessId: string;
  offeringId?: string;
  exposureReason?: string;
  ownerManaged?: boolean;
}>;

export type PlayDiscoveryItem = {
  id: string;
  canonicalKey?: string;
  sourceKind: PlaySourceKind;
  contentKind: PlayContentKind;
  eventId?: string;
  venueId?: string;
  offeringId?: string;
  organizerIds?: readonly string[];
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
  imageUrl?: string;
  priceLabel?: string;
  /** Distance/travel time are resolved upstream from shared Map/Location infrastructure. */
  distanceM?: number;
  travelTimeMinutes?: number;
  distanceLabel?: string;
  experienceTags?: readonly string[];
  primaryAction?: PlayDiscoveryAction;
  alternateActions?: readonly PlayDiscoveryAction[];
  placeId?: string;
  businessId?: string;
  businessProjection?: PlayBusinessProjectionRef;
  source: PlayDiscoverySource;
  alternateSources?: readonly PlayDiscoverySource[];
};

export type PlayDiscoveryContext = {
  locality?: string;
  selectedTheme?: PlayThemeKey;
};

export function isPublicPlayItem(item: PlayDiscoveryItem): boolean {
  return item.sourceKind === 'municipal_event' || item.sourceKind === 'public_program';
}

export function isBusinessPlayItem(item: PlayDiscoveryItem): boolean {
  return item.sourceKind === 'business' && Boolean(item.businessProjection?.businessId ?? item.businessId);
}

export function matchesPlayTheme(item: PlayDiscoveryItem, theme: PlayThemeKey): boolean {
  if (theme === 'free' && item.isFree) return true;
  return item.themeTags.includes(theme);
}

function canonicalBusinessId(item: PlayDiscoveryItem): string | undefined {
  return item.businessProjection?.businessId ?? item.businessId;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function validatePlayDiscoveryItem(item: PlayDiscoveryItem): readonly string[] {
  const issues: string[] = [];
  if (!item.id.trim()) issues.push('play_item_id_required');
  if (item.canonicalKey !== undefined && !item.canonicalKey.trim()) issues.push('canonical_key_invalid');
  if (!item.contentKind?.trim()) issues.push('content_kind_required');
  if (!item.title.trim()) issues.push('title_required');
  if (!item.comuna.trim()) issues.push('comuna_required');
  if (!item.scheduleLabel.trim()) issues.push('schedule_required');
  if (!item.source.authority.trim()) issues.push('source_authority_required');
  if (item.distanceM !== undefined && (!Number.isFinite(item.distanceM) || item.distanceM < 0)) issues.push('distance_m_invalid');
  if (item.travelTimeMinutes !== undefined && (!Number.isFinite(item.travelTimeMinutes) || item.travelTimeMinutes < 0)) issues.push('travel_time_invalid');
  if (item.primaryAction && !isHttpUrl(item.primaryAction.url)) issues.push('primary_action_url_invalid');
  for (const action of item.alternateActions ?? []) {
    if (!isHttpUrl(action.url)) issues.push('alternate_action_url_invalid');
  }
  if (item.sourceKind === 'business' && !canonicalBusinessId(item)?.trim()) issues.push('canonical_business_id_required');
  if (item.businessProjection?.businessId && item.businessId && item.businessProjection.businessId !== item.businessId) {
    issues.push('business_projection_identity_mismatch');
  }
  return [...new Set(issues)];
}

function compareTravelTime(left: PlayDiscoveryItem, right: PlayDiscoveryItem): number {
  if (left.travelTimeMinutes !== undefined && right.travelTimeMinutes !== undefined) return left.travelTimeMinutes - right.travelTimeMinutes;
  if (left.travelTimeMinutes !== undefined) return -1;
  if (right.travelTimeMinutes !== undefined) return 1;
  return 0;
}

function compareDistance(left: PlayDiscoveryItem, right: PlayDiscoveryItem): number {
  if (left.distanceM !== undefined && right.distanceM !== undefined) return left.distanceM - right.distanceM;
  if (left.distanceM !== undefined) return -1;
  if (right.distanceM !== undefined) return 1;
  return 0;
}

function compareStartTime(left: PlayDiscoveryItem, right: PlayDiscoveryItem): number {
  if (left.startAt && right.startAt) return left.startAt.localeCompare(right.startAt);
  if (left.startAt) return -1;
  if (right.startAt) return 1;
  return 0;
}

/** Organic ordering never accepts commission or deal terms. */
export function selectPlayDiscoveryItems(
  items: readonly PlayDiscoveryItem[],
  context: PlayDiscoveryContext = {},
): PlayDiscoveryItem[] {
  const validItems = items.filter((item) => validatePlayDiscoveryItem(item).length === 0);
  const filtered = context.selectedTheme
    ? validItems.filter((item) => matchesPlayTheme(item, context.selectedTheme as PlayThemeKey))
    : [...validItems];

  return filtered.sort((left, right) => {
    const travelTimeOrder = compareTravelTime(left, right);
    if (travelTimeOrder !== 0) return travelTimeOrder;
    const distanceOrder = compareDistance(left, right);
    if (distanceOrder !== 0) return distanceOrder;
    const leftLocal = context.locality && left.comuna === context.locality ? 0 : 1;
    const rightLocal = context.locality && right.comuna === context.locality ? 0 : 1;
    if (leftLocal !== rightLocal) return leftLocal - rightLocal;
    const timeOrder = compareStartTime(left, right);
    if (timeOrder !== 0) return timeOrder;
    const leftPublic = isPublicPlayItem(left) ? 0 : 1;
    const rightPublic = isPublicPlayItem(right) ? 0 : 1;
    if (leftPublic !== rightPublic) return leftPublic - rightPublic;
    return left.title.localeCompare(right.title, 'es');
  });
}
