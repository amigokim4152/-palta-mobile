export type BusinessOperationalState =
  | 'open_now'
  | 'closed_now'
  | 'closed_today'
  | 'temporarily_closed'
  | 'seasonal_closed'
  | 'paused'
  | 'permanently_closed'
  | 'unknown_or_stale';

export type BusinessOperationalSource =
  | 'owner'
  | 'trusted_source'
  | 'schedule'
  | 'trading_session'
  | 'system'
  | 'unknown';

export type BusinessOperationalOverride = {
  state:
    | 'open_now'
    | 'closed_today'
    | 'temporarily_closed'
    | 'seasonal_closed';
  source: Exclude<BusinessOperationalSource, 'schedule' | 'unknown'>;
  confirmedAt?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
  nextOpenAt?: string;
};

export type BusinessOperationalProjection = {
  state: BusinessOperationalState;
  source: BusinessOperationalSource;
  confirmedAt?: string;
  nextOpenAt?: string;
  stale: boolean;
};

export type BusinessLifecycleStatus = 'active' | 'paused' | 'closed';

function timestamp(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isWithinWindow(
  override: BusinessOperationalOverride,
  nowMs: number,
): boolean {
  const startsAt = timestamp(override.effectiveFrom);
  const endsAt = timestamp(override.effectiveUntil);
  if (startsAt !== null && nowMs < startsAt) return false;
  if (endsAt !== null && nowMs >= endsAt) return false;
  return true;
}

function evidenceIsStale(input: {
  confirmedAt: string | undefined;
  nowMs: number;
  maxAgeMs: number | undefined;
}): boolean {
  if (input.maxAgeMs === undefined) return false;
  const confirmedAt = timestamp(input.confirmedAt);
  if (confirmedAt === null) return true;
  return input.nowMs - confirmedAt > input.maxAgeMs;
}

/**
 * Projects consumer-facing availability from canonical lifecycle + a current
 * owner/trusted override + the normalized schedule result.
 *
 * Schedule calculation itself belongs to the time/schedule adapter. This
 * function only decides precedence and prevents stale evidence from becoming
 * a confident `open_now` claim.
 */
export function resolveBusinessOperationalState(input: {
  lifecycleStatus?: BusinessLifecycleStatus;
  override?: BusinessOperationalOverride;
  scheduledOpenNow?: boolean;
  scheduleConfirmedAt?: string;
  now: string | Date;
  maxScheduleAgeMs?: number;
  maxOpenOverrideAgeMs?: number;
}): BusinessOperationalProjection {
  const nowMs =
    input.now instanceof Date ? input.now.getTime() : Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new Error('Invalid operational-state now');

  if (input.lifecycleStatus === 'closed') {
    return {
      state: 'permanently_closed',
      source: 'system',
      stale: false,
    };
  }

  const override = input.override;
  if (override && isWithinWindow(override, nowMs)) {
    const openOverrideStale =
      override.state === 'open_now' &&
      evidenceIsStale({
        confirmedAt: override.confirmedAt,
        nowMs,
        maxAgeMs: input.maxOpenOverrideAgeMs,
      });

    if (!openOverrideStale) {
      return {
        state: override.state,
        source: override.source,
        ...(override.confirmedAt ? { confirmedAt: override.confirmedAt } : {}),
        ...(override.nextOpenAt ? { nextOpenAt: override.nextOpenAt } : {}),
        stale: false,
      };
    }
  }

  if (input.lifecycleStatus === 'paused') {
    return {
      state: 'paused',
      source: 'system',
      stale: false,
    };
  }

  if (input.scheduledOpenNow === undefined) {
    return {
      state: 'unknown_or_stale',
      source: 'unknown',
      stale: true,
    };
  }

  const scheduleStale = evidenceIsStale({
    confirmedAt: input.scheduleConfirmedAt,
    nowMs,
    maxAgeMs: input.maxScheduleAgeMs,
  });

  if (scheduleStale) {
    return {
      state: 'unknown_or_stale',
      source: 'schedule',
      ...(input.scheduleConfirmedAt
        ? { confirmedAt: input.scheduleConfirmedAt }
        : {}),
      stale: true,
    };
  }

  return {
    state: input.scheduledOpenNow ? 'open_now' : 'closed_now',
    source: 'schedule',
    ...(input.scheduleConfirmedAt
      ? { confirmedAt: input.scheduleConfirmedAt }
      : {}),
    stale: false,
  };
}

export function businessOperationalSortRank(
  state?: BusinessOperationalState,
): number {
  switch (state) {
    case 'open_now':
      return 0;
    case 'unknown_or_stale':
      return 1;
    case 'closed_now':
      return 2;
    case 'closed_today':
      return 3;
    case 'temporarily_closed':
      return 4;
    case 'seasonal_closed':
      return 5;
    case 'paused':
      return 6;
    case 'permanently_closed':
      return 7;
    default:
      return 1;
  }
}

export function isOrdinarilyDiscoverableBusinessState(
  state?: BusinessOperationalState,
): boolean {
  return state !== 'permanently_closed';
}
