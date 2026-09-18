import type { AutosDealerRegistryEntry, AutosDealerSource } from './autosDealerRegistry.js';

export type AutosDealerSeedCandidate = {
  source: AutosDealerSource;
  sourceRecordId: string;
  sourceRef: string;
  displayName: string;
  website?: string;
  comuna?: string;
  discoveredAt: string;
};

export type AutosDealerSeedResolution =
  | {
      status: 'matched_existing_business';
      candidate: AutosDealerSeedCandidate;
      businessId: string;
    }
  | {
      status: 'new_business_candidate';
      candidate: AutosDealerSeedCandidate;
    }
  | {
      status: 'rejected_non_dealer';
      candidate: AutosDealerSeedCandidate;
      reason: string;
    };

export function dealerSeedDedupeKey(candidate: AutosDealerSeedCandidate): string {
  const websiteHost = candidate.website
    ? candidate.website
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
    : '';
  return [
    candidate.displayName.trim().toLowerCase().replace(/\s+/g, ' '),
    websiteHost,
    candidate.comuna?.trim().toLowerCase() ?? '',
  ].join('|');
}

export function registryDraftFromResolvedSeed(
  resolution: Extract<AutosDealerSeedResolution, { status: 'matched_existing_business' }>,
): AutosDealerRegistryEntry {
  return {
    businessId: resolution.businessId,
    legalOrTradeName: resolution.candidate.displayName,
    comuna: resolution.candidate.comuna ?? 'unknown',
    regionCode: 'CL-RM',
    source: resolution.candidate.source,
    sourceRef: resolution.candidate.sourceRef,
    verification: 'unverified',
    capabilities: [],
    acquisition: {
      enabled: false,
      serviceComunas: [],
    },
  };
}
