import type { ServiceProviderIdentity } from './serviceTaxonomy.js';

export type ProviderRoutingInput = {
  categoryId: string;
  serviceAreaId: string;
  maxProviders: number;
  providerIdsSeenRecently?: readonly string[];
};

export type ProviderCandidate = ServiceProviderIdentity & {
  distanceRank?: number;
  responseQualityRank?: number;
  availabilityRank?: number;
};

function score(candidate: ProviderCandidate, recentlySeen: Set<string>): number {
  let value = 0;

  if (candidate.verified) value += 3;
  if (candidate.distanceRank !== undefined) value += Math.max(0, 3 - candidate.distanceRank);
  if (candidate.responseQualityRank !== undefined) {
    value += Math.max(0, 3 - candidate.responseQualityRank);
  }
  if (candidate.availabilityRank !== undefined) {
    value += Math.max(0, 2 - candidate.availabilityRank);
  }
  if (recentlySeen.has(candidate.providerId)) value -= 2;

  return value;
}

/**
 * Routing is deliberately not "highest payer wins".
 * Paid promotion, if ever enabled, must remain a separate clearly-labeled surface.
 */
export function routeProviders(
  input: ProviderRoutingInput,
  candidates: readonly ProviderCandidate[],
): ProviderCandidate[] {
  const recentlySeen = new Set(input.providerIdsSeenRecently ?? []);

  return candidates
    .filter((candidate) => candidate.categoryIds.includes(input.categoryId))
    .filter((candidate) => candidate.serviceAreaIds.includes(input.serviceAreaId))
    .sort((a, b) => {
      const scoreDelta = score(b, recentlySeen) - score(a, recentlySeen);
      if (scoreDelta !== 0) return scoreDelta;
      return a.providerId.localeCompare(b.providerId);
    })
    .slice(0, input.maxProviders);
}
