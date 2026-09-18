import type { VehicleBusinessCapability } from './autosSellerModel.js';

export type AutosDealerSource =
  | 'cavem_public_directory'
  | 'public_business_source'
  | 'business_self_registration'
  | 'partner_import';

export type AutosDealerVerification =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'suspended';

export type AutosDealerRegistryEntry = {
  businessId: string;
  legalOrTradeName: string;
  comuna: string;
  regionCode: string;
  source: AutosDealerSource;
  sourceRef?: string;
  verification: AutosDealerVerification;
  capabilities: readonly VehicleBusinessCapability[];
  acquisition: {
    enabled: boolean;
    serviceComunas: readonly string[];
    acceptedMakes?: readonly string[];
    minYear?: number;
    maxMileageKm?: number;
    dailyCapacity?: number;
  };
};

export type VehicleAcquisitionRoutingRequest = {
  requestId: string;
  comuna: string;
  make: string;
  year: number;
  mileageKm: number;
};

export type AutosDealerRoutingCandidate = {
  businessId: string;
  legalOrTradeName: string;
  eligible: boolean;
  reasons: readonly string[];
};

export const CAVEM_DIRECTORY_SOURCE = {
  id: 'cavem-public-directory',
  url: 'https://www.cavem.cl/socios',
  role: 'seed_only',
  note: 'CAVEM membership is useful provenance for discovery but does not itself grant Palta verification or bidding access.',
} as const;

export function evaluateDealerForAcquisition(
  dealer: AutosDealerRegistryEntry,
  request: VehicleAcquisitionRoutingRequest,
): AutosDealerRoutingCandidate {
  const reasons: string[] = [];

  if (dealer.verification !== 'verified') reasons.push('dealer_not_verified');
  if (!dealer.capabilities.includes('vehicle_private_buy_bid')) reasons.push('missing_private_buy_capability');
  if (!dealer.acquisition.enabled) reasons.push('acquisition_disabled');
  if (!dealer.acquisition.serviceComunas.includes(request.comuna)) reasons.push('outside_service_area');
  if (dealer.acquisition.acceptedMakes && !dealer.acquisition.acceptedMakes.includes(request.make)) {
    reasons.push('make_not_accepted');
  }
  if (dealer.acquisition.minYear !== undefined && request.year < dealer.acquisition.minYear) {
    reasons.push('vehicle_too_old');
  }
  if (
    dealer.acquisition.maxMileageKm !== undefined &&
    request.mileageKm > dealer.acquisition.maxMileageKm
  ) {
    reasons.push('mileage_over_limit');
  }

  return {
    businessId: dealer.businessId,
    legalOrTradeName: dealer.legalOrTradeName,
    eligible: reasons.length === 0,
    reasons,
  };
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function routeEligibleDealers(
  dealers: readonly AutosDealerRegistryEntry[],
  request: VehicleAcquisitionRoutingRequest,
  limit: number,
): readonly AutosDealerRoutingCandidate[] {
  if (!Number.isInteger(limit) || limit <= 0) throw new Error('Dealer routing limit must be a positive integer.');

  return dealers
    .map((dealer) => evaluateDealerForAcquisition(dealer, request))
    .filter((candidate) => candidate.eligible)
    .sort((a, b) => {
      const aHash = stableHash(`${request.requestId}:${a.businessId}`);
      const bHash = stableHash(`${request.requestId}:${b.businessId}`);
      return aHash - bHash || a.businessId.localeCompare(b.businessId);
    })
    .slice(0, limit);
}
