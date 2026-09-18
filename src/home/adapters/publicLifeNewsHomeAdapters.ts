import type { HomeApiItem } from '../../api/paltaApiClient.js';
import type { HomeDataMode } from '../homeRuntimeContract.js';
import type { HomeSourceContribution } from '../homeSourceContract.js';

export type VerificationState =
  | 'verified'
  | 'corroborated'
  | 'needs_verification'
  | 'stale'
  | 'conflict'
  | 'rejected';

export type MunicipalHomeRecord = {
  id: string;
  title: string;
  summary?: string;
  verification: VerificationState;
  localityMatches: boolean;
  eligibilityRelevant: boolean;
  validFrom?: string;
  validUntil?: string;
  deadlineAt?: string;
  ongoing?: boolean;
  sourceUrl?: string;
};

export type NewsHomeRecord = {
  id: string;
  title: string;
  summary?: string;
  localityMatches: boolean;
  relevance: number;
  publishedAt: string;
  sourceUrl?: string;
};

function time(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function municipalRecordIsCurrent(record: MunicipalHomeRecord, now: Date): boolean {
  if (record.verification !== 'verified' && record.verification !== 'corroborated') {
    return false;
  }
  if (!record.localityMatches || !record.eligibilityRelevant) return false;

  const from = time(record.validFrom);
  const until = time(record.validUntil);
  const deadline = time(record.deadlineAt);

  if (!record.ongoing && until === undefined && deadline === undefined) return false;
  if (from !== undefined && from > now.getTime()) return false;
  if (until !== undefined && until < now.getTime()) return false;
  if (!record.ongoing && deadline !== undefined && deadline < now.getTime()) return false;
  return true;
}

export function municipalToHome(input: {
  dataMode: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
  localityLabel?: string;
  records: readonly MunicipalHomeRecord[];
}, now = new Date()): HomeSourceContribution {
  const items: HomeApiItem[] = input.records
    .filter((record) => municipalRecordIsCurrent(record, now))
    .map((record) => {
      const deadline = time(record.deadlineAt);
      const withinThreeDays =
        deadline !== undefined &&
        deadline >= now.getTime() &&
        deadline - now.getTime() <= 3 * 24 * 60 * 60 * 1000;

      return {
        id: `public-life-${record.id}`,
        kind: withinThreeDays ? ('action' as const) : ('useful_today' as const),
        title: record.title,
        ...(record.summary ? { body: record.summary } : {}),
        source_domain: 'public-life',
        delivery: withinThreeDays ? ('home_notify' as const) : ('home' as const),
        related_entity_id: record.id,
        ...(record.sourceUrl
          ? {
              action_label: withinThreeDays ? 'Ver requisitos' : 'Ver información',
              action_target: record.sourceUrl,
              action_kind: 'external' as const,
            }
          : {}),
      };
    });

  return {
    source_domain: 'public-life',
    data_mode: input.dataMode,
    observed_at: input.observedAt,
    ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
    ...(input.localityLabel ? { locality_label: input.localityLabel } : {}),
    items,
  };
}

export function newsToHome(input: {
  dataMode: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
  localityLabel?: string;
  records: readonly NewsHomeRecord[];
  maxAgeHours?: number;
  minimumRelevance?: number;
}, now = new Date()): HomeSourceContribution {
  const maxAgeMs = (input.maxAgeHours ?? 48) * 60 * 60 * 1000;
  const minimumRelevance = input.minimumRelevance ?? 0.6;

  const items: HomeApiItem[] = input.records
    .filter((record) => {
      if (!record.localityMatches || record.relevance < minimumRelevance) return false;
      const published = Date.parse(record.publishedAt);
      if (!Number.isFinite(published)) return false;
      const age = now.getTime() - published;
      return age >= 0 && age <= maxAgeMs;
    })
    .sort((a, b) => b.relevance - a.relevance)
    .map((record) => ({
      id: `news-${record.id}`,
      kind: 'content' as const,
      title: record.title,
      ...(record.summary ? { body: record.summary } : {}),
      source_domain: 'news',
      delivery: 'home' as const,
      related_entity_id: record.id,
      ...(record.sourceUrl
        ? {
            action_label: 'Leer fuente',
            action_target: record.sourceUrl,
            action_kind: 'external' as const,
          }
        : {}),
    }));

  return {
    source_domain: 'news',
    data_mode: input.dataMode,
    observed_at: input.observedAt,
    ...(input.expiresAt ? { expires_at: input.expiresAt } : {}),
    ...(input.localityLabel ? { locality_label: input.localityLabel } : {}),
    items,
  };
}
