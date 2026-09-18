import type { HomeFunctionalItem } from './homeFunctionalContract.js';

export type HomeBehaviorDimension = 'capability' | 'domain' | 'subject';

/**
 * Privacy-minimized behavior summary. The upstream owner may derive these
 * counters from explicit user actions, but Home never needs a raw interaction
 * timeline, dwell time, clickstream, or readable subject label.
 */
export type HomeBehaviorAggregate = {
  dimension: HomeBehaviorDimension;
  key: string;
  actionCompletedCount?: number;
  usefulConfirmedCount?: number;
  notRelevantCount?: number;
  explicitSuppression?: boolean;
};

export type HomeBehaviorProfile = {
  aggregates: readonly HomeBehaviorAggregate[];
};

const MAX_COUNT_EVIDENCE = 8;
const MAX_ABSOLUTE_ADJUSTMENT = 0.5;

function boundedCount(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_COUNT_EVIDENCE, Math.floor(value));
}

function aggregateKeyForItem(
  aggregate: HomeBehaviorAggregate,
  item: HomeFunctionalItem,
): string | undefined {
  switch (aggregate.dimension) {
    case 'capability':
      return item.capabilityKey;
    case 'domain':
      return item.source.domain;
    case 'subject':
      return item.subject?.id;
  }
}

function matchingAggregates(
  item: HomeFunctionalItem,
  profile: HomeBehaviorProfile | undefined,
): HomeBehaviorAggregate[] {
  if (!profile) return [];
  return profile.aggregates.filter((aggregate) => {
    const itemKey = aggregateKeyForItem(aggregate, item);
    return Boolean(itemKey) && itemKey === aggregate.key;
  });
}

function specificityWeight(dimension: HomeBehaviorDimension): number {
  switch (dimension) {
    case 'capability':
      return 1;
    case 'subject':
      return 0.8;
    case 'domain':
      return 0.65;
  }
}

/**
 * Explicit, aggregate behavior may fine-tune relevance, but it cannot overtake
 * the semantic Home rules. Alerts and high-consequence items are protected;
 * Home must never learn to hide safety/deadline state because it gets fewer taps.
 */
export function homeBehaviorPriorityAdjustment(
  item: HomeFunctionalItem,
  profile: HomeBehaviorProfile | undefined,
): number {
  if (!profile) return 0;
  if (item.kind === 'alert' || (item.urgency ?? 0) >= 3 || (item.importance ?? 0) >= 4) {
    return 0;
  }

  let adjustment = 0;
  for (const aggregate of matchingAggregates(item, profile)) {
    const positive =
      boundedCount(aggregate.actionCompletedCount) * 0.035 +
      boundedCount(aggregate.usefulConfirmedCount) * 0.045;
    const negative = boundedCount(aggregate.notRelevantCount) * 0.06;
    adjustment += (positive - negative) * specificityWeight(aggregate.dimension);
  }

  const kindWeight =
    item.kind === 'content' || item.kind === 'useful'
      ? 1
      : item.kind === 'status'
        ? 0.55
        : 0.35;

  return Math.max(
    -MAX_ABSOLUTE_ADJUSTMENT,
    Math.min(MAX_ABSOLUTE_ADJUSTMENT, adjustment * kindWeight),
  );
}

/**
 * Explicit suppression is honored only for passive/useful material. Required
 * actions and alerts remain visible until the owning Core reconciles their state.
 */
export function isHomeItemExplicitlySuppressed(
  item: HomeFunctionalItem,
  profile: HomeBehaviorProfile | undefined,
): boolean {
  if (!profile) return false;
  if (item.kind !== 'content' && item.kind !== 'useful') return false;
  return matchingAggregates(item, profile).some(
    (aggregate) => aggregate.explicitSuppression === true,
  );
}
