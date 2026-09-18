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

export type PlayBusinessProjectionRef = Readonly<{
  /** Canonical Business id owned by Business Core. Play never creates a second business. */
  businessId: string;
  /** Optional canonical offering/service package shown in this Play context. */
  offeringId?: string;
  /** Why Business Core/vertical classification exposed this business in Play. */
  exposureReason?: string;
  /** Informational only. Management authority remains in Business Core. */
  ownerManaged?: boolean;
}>;

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
  imageUrl?: string;
  priceLabel?: string;
  distanceLabel?: string;
  experienceTags?: readonly string[];
  placeId?: string;
  businessId?: string;
  businessProjection?: PlayBusinessProjectionRef;
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

export function isBusinessPlayItem(item: PlayDiscoveryItem): boolean {
  return item.sourceKind === 'business' && Boolean(item.businessProjection?.businessId ?? item.businessId);
}

export function matchesPlayTheme(
  item: PlayDiscoveryItem,
  theme: PlayThemeKey,
): boolean {
  if (theme === 'free' && item.isFree) return true;
  return item.themeTags.includes(theme);
}

function canonicalBusinessId(item: PlayDiscoveryItem): string | undefined {
  return item.businessProjection?.businessId ?? item.businessId;
}

/**
 * Play is a discovery projection, not a Business store.
 * Business-backed items must always retain the canonical Business id so profile,
 * map, booking, messaging, owner changes and future surfaces converge on one entity.
 */
export function validatePlayDiscoveryItem(item: PlayDiscoveryItem): readonly string[] {
  const issues: string[] = [];
  if (!item.id.trim()) issues.push('play_item_id_required');
  if (!item.title.trim()) issues.push('title_required');
  if (!item.comuna.trim()) issues.push('comuna_required');
  if (!item.scheduleLabel.trim()) issues.push('schedule_required');
  if (!item.source.authority.trim()) issues.push('source_authority_required');
  if (item.sourceKind === 'business' && !canonicalBusinessId(item)?.trim()) {
    issues.push('canonical_business_id_required');
  }
  if (
    item.businessProjection?.businessId &&
    item.businessId &&
    item.businessProjection.businessId !== item.businessId
  ) {
    issues.push('business_projection_identity_mismatch');
  }
  return [...new Set(issues)];
}

export function selectPlayDiscoveryItems(
  items: readonly PlayDiscoveryItem[],
  context: PlayDiscoveryContext = {},
): PlayDiscoveryItem[] {
  const validItems = items.filter((item) => validatePlayDiscoveryItem(item).length === 0);
  const filtered = context.selectedTheme
    ? validItems.filter((item) =>
        matchesPlayTheme(item, context.selectedTheme as PlayThemeKey),
      )
    : [...validItems];

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
