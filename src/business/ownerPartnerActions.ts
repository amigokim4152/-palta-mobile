export type OwnerPartnerActionClass =
  | 'urgent_customer_or_operation'
  | 'stale_or_inaccurate_truth'
  | 'requested_follow_up'
  | 'free_practical_improvement'
  | 'repeated_workflow_friction'
  | 'optional_automation'
  | 'generic_education';

export type OwnerPartnerAction = {
  id: string;
  class: OwnerPartnerActionClass;
  title: string;
  reason: string;
  target: string;
  evidenceRefs: readonly string[];
  actionRequired: boolean;
  commercial: 'free' | 'may_be_paid' | 'unknown';
  urgency?: 0 | 1 | 2 | 3 | 4;
  observedAt?: string;
};

const classRank: Record<OwnerPartnerActionClass, number> = {
  urgent_customer_or_operation: 0,
  stale_or_inaccurate_truth: 1,
  requested_follow_up: 2,
  free_practical_improvement: 3,
  repeated_workflow_friction: 4,
  optional_automation: 5,
  generic_education: 6,
};

function commercialRank(action: OwnerPartnerAction): number {
  if (action.commercial === 'free') return 0;
  if (action.commercial === 'unknown') return 1;
  return 2;
}

/**
 * Business Partner Home ranks real obligations and free corrections before
 * commercial opportunities. Empty input deliberately returns an empty home.
 */
export function rankOwnerPartnerActions(
  actions: readonly OwnerPartnerAction[],
  limit = 5,
): OwnerPartnerAction[] {
  return actions
    .filter((action) => action.evidenceRefs.length > 0)
    .slice()
    .sort((a, b) => {
      const classDelta = classRank[a.class] - classRank[b.class];
      if (classDelta !== 0) return classDelta;

      const urgencyDelta = (b.urgency ?? 0) - (a.urgency ?? 0);
      if (urgencyDelta !== 0) return urgencyDelta;

      const commercialDelta = commercialRank(a) - commercialRank(b);
      if (commercialDelta !== 0) return commercialDelta;

      const aTime = a.observedAt ? Date.parse(a.observedAt) : Number.NEGATIVE_INFINITY;
      const bTime = b.observedAt ? Date.parse(b.observedAt) : Number.NEGATIVE_INFINITY;
      if (aTime !== bTime) return bTime - aTime;
      return a.id.localeCompare(b.id);
    })
    .slice(0, Math.max(0, limit));
}

export function shouldSurfaceCommercialUpgrade(
  actions: readonly OwnerPartnerAction[],
  candidateId: string,
): boolean {
  const ranked = rankOwnerPartnerActions(actions, actions.length);
  const candidateIndex = ranked.findIndex((action) => action.id === candidateId);
  if (candidateIndex < 0) return false;

  const candidate = ranked[candidateIndex]!;
  if (candidate.commercial !== 'may_be_paid') return true;

  return !ranked
    .slice(0, candidateIndex)
    .some(
      (action) =>
        action.class === 'urgent_customer_or_operation' ||
        action.class === 'stale_or_inaccurate_truth' ||
        action.class === 'requested_follow_up',
    );
}
