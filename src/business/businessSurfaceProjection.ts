export const businessSurfaceKeys = [
  'local_business',
  'play',
  'home',
  'map',
  'search',
  'community',
  'market',
  'care',
] as const;

export type BusinessSurfaceKey = (typeof businessSurfaceKeys)[number];

export type BusinessOwnershipState =
  | 'unclaimed'
  | 'claim_pending'
  | 'claimed'
  | 'verified'
  | 'suspended';

export type BusinessLifecycleState = 'active' | 'paused' | 'closed';

export type BusinessSurfaceCandidate = Readonly<{
  surface: BusinessSurfaceKey;
  reason: string;
  serviceIds?: readonly string[];
  offeringIds?: readonly string[];
  capabilityIds?: readonly string[];
}>;

export type CanonicalBusinessProjectionInput = Readonly<{
  businessId: string;
  ownershipState: BusinessOwnershipState;
  lifecycleState: BusinessLifecycleState;
  publicDiscoveryEnabled: boolean;
  serviceIds: readonly string[];
  offeringIds?: readonly string[];
  capabilityIds?: readonly string[];
  updatedAt?: string;
}>;

export type BusinessSurfaceExposure = Readonly<{
  businessId: string;
  surface: BusinessSurfaceKey;
  eligible: boolean;
  ownerManaged: boolean;
  reason: string;
  serviceIds: readonly string[];
  offeringIds: readonly string[];
  capabilityIds: readonly string[];
  blockedBy: readonly string[];
}>;

function allIncluded(
  required: readonly string[] | undefined,
  actual: readonly string[] | undefined,
): boolean {
  if (!required?.length) return true;
  const set = new Set(actual ?? []);
  return required.every((value) => set.has(value));
}

/**
 * Shared Business Core projection rule.
 *
 * Business remains canonical. Surfaces such as Play, Map, Search and Home never
 * create a second business record. A vertical/domain resolver proposes a
 * candidate exposure from canonical services/offerings/capabilities; this
 * function only decides whether the canonical Business may be projected and
 * whether the owner is allowed to manage the projected content directly.
 *
 * Publicly discovered businesses may be visible before claim. Claim/verification
 * changes management authority, not identity. Once verified, owner edits remain
 * attached to the same businessId and therefore propagate to every surface that
 * consumes the projection.
 */
export function projectCanonicalBusinessToSurface(
  business: CanonicalBusinessProjectionInput,
  candidate: BusinessSurfaceCandidate,
): BusinessSurfaceExposure {
  const blockedBy: string[] = [];

  if (!business.businessId.trim()) blockedBy.push('business_id_required');
  if (business.lifecycleState !== 'active') blockedBy.push('business_not_active');
  if (!business.publicDiscoveryEnabled) blockedBy.push('public_discovery_disabled');
  if (business.ownershipState === 'suspended') blockedBy.push('ownership_suspended');
  if (!allIncluded(candidate.serviceIds, business.serviceIds)) {
    blockedBy.push('required_service_missing');
  }
  if (!allIncluded(candidate.offeringIds, business.offeringIds)) {
    blockedBy.push('required_offering_missing');
  }
  if (!allIncluded(candidate.capabilityIds, business.capabilityIds)) {
    blockedBy.push('required_capability_missing');
  }

  return {
    businessId: business.businessId,
    surface: candidate.surface,
    eligible: blockedBy.length === 0,
    ownerManaged: business.ownershipState === 'verified',
    reason: candidate.reason,
    serviceIds: [...(candidate.serviceIds ?? [])],
    offeringIds: [...(candidate.offeringIds ?? [])],
    capabilityIds: [...(candidate.capabilityIds ?? [])],
    blockedBy: [...new Set(blockedBy)],
  };
}

export function projectCanonicalBusinessToSurfaces(
  business: CanonicalBusinessProjectionInput,
  candidates: readonly BusinessSurfaceCandidate[],
): readonly BusinessSurfaceExposure[] {
  const seen = new Set<string>();
  const exposures: BusinessSurfaceExposure[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.surface}:${candidate.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    exposures.push(projectCanonicalBusinessToSurface(business, candidate));
  }

  return exposures;
}

export function visibleBusinessSurfaceExposures(
  exposures: readonly BusinessSurfaceExposure[],
): readonly BusinessSurfaceExposure[] {
  return exposures.filter((exposure) => exposure.eligible);
}
