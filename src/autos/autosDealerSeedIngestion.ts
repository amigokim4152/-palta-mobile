import {
  dealerSeedDedupeKey,
  type AutosDealerSeedCandidate,
  type AutosDealerSeedResolution,
} from './autosDealerSeed.js';

export type DealerDirectorySnapshotStatus = 'current' | 'stale' | 'superseded' | 'rejected';

export type AutosDealerDirectoryRawRecord = {
  sourceRecordId: string;
  displayName: string;
  website?: string;
  comuna?: string;
};

export type AutosDealerDirectorySnapshot = {
  snapshotId: string;
  source: 'cavem_public_directory';
  sourceUrl: string;
  collectedAt: string;
  contentSha256: string;
  status: DealerDirectorySnapshotStatus;
  records: readonly AutosDealerDirectoryRawRecord[];
};

export const CAVEM_CENTRO_DIRECTORY = {
  id: 'cavem-centro',
  url: 'https://www.cavem.cl/socios_centro',
  role: 'seed_only',
  containsPersonalData: false,
  grantsPaltaVerification: false,
  grantsBidCapability: false,
} as const;

export function normalizeDealerWebsite(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withProtocol);
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
    return url.toString().replace(/\/$/, '');
  } catch {
    return undefined;
  }
}

export function candidatesFromDealerDirectorySnapshot(
  snapshot: AutosDealerDirectorySnapshot,
): readonly AutosDealerSeedCandidate[] {
  if (snapshot.status === 'rejected') return [];

  const candidates: AutosDealerSeedCandidate[] = [];
  const seen = new Set<string>();

  for (const record of snapshot.records) {
    const displayName = record.displayName.trim().replace(/\s+/g, ' ');
    if (!displayName) continue;

    const candidate: AutosDealerSeedCandidate = {
      source: 'cavem_public_directory',
      sourceRecordId: record.sourceRecordId,
      sourceRef: `${snapshot.sourceUrl}#${encodeURIComponent(record.sourceRecordId)}`,
      displayName,
      ...(normalizeDealerWebsite(record.website) ? { website: normalizeDealerWebsite(record.website)! } : {}),
      ...(record.comuna?.trim() ? { comuna: record.comuna.trim() } : {}),
      discoveredAt: snapshot.collectedAt,
    };

    const key = dealerSeedDedupeKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
  }

  return candidates;
}

export type CanonicalBusinessMatch = {
  businessId: string;
  displayName: string;
  website?: string;
  comuna?: string;
};

function host(value: string | undefined): string {
  if (!value) return '';
  try {
    return new URL(normalizeDealerWebsite(value) ?? value).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function normalizedName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(s\.a\.|spa|ltda\.?|limitada|sociedad anonima)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Conservative reconciliation only. Website host is the strongest automatic signal.
 * Name+comuna may create a review suggestion, but never silently creates or verifies a Business.
 */
export function reconcileDealerSeedCandidate(
  candidate: AutosDealerSeedCandidate,
  businesses: readonly CanonicalBusinessMatch[],
): AutosDealerSeedResolution {
  const candidateHost = host(candidate.website);
  if (candidateHost) {
    const websiteMatches = businesses.filter((business) => host(business.website) === candidateHost);
    if (websiteMatches.length === 1) {
      return {
        status: 'matched_existing_business',
        candidate,
        businessId: websiteMatches[0]!.businessId,
      };
    }
  }

  const name = normalizedName(candidate.displayName);
  const comuna = candidate.comuna?.trim().toLowerCase();
  const plausible = businesses.filter((business) => {
    if (normalizedName(business.displayName) !== name) return false;
    if (!comuna || !business.comuna) return true;
    return business.comuna.trim().toLowerCase() === comuna;
  });

  if (plausible.length === 1 && !candidateHost && !plausible[0]!.website) {
    return {
      status: 'matched_existing_business',
      candidate,
      businessId: plausible[0]!.businessId,
    };
  }

  return { status: 'new_business_candidate', candidate };
}
