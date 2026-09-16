export type ProviderUsageGuard = {
  provider: string;
  metric: string;
  freeLimit?: number;
  currentUsage: number;
  projectedMonthlyCostUsd?: number;
};

export type CostGuardState =
  | 'ok'
  | 'warn_70'
  | 'optimize_85'
  | 'decision_95'
  | 'over_limit'
  | 'unbounded';

export function classifyProviderUsage(
  guard: ProviderUsageGuard,
): CostGuardState {
  if (!guard.freeLimit || guard.freeLimit <= 0) return 'unbounded';

  const ratio = guard.currentUsage / guard.freeLimit;
  if (ratio >= 1) return 'over_limit';
  if (ratio >= 0.95) return 'decision_95';
  if (ratio >= 0.85) return 'optimize_85';
  if (ratio >= 0.70) return 'warn_70';
  return 'ok';
}
