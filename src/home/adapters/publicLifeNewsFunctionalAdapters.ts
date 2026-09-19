import type {
  HomeCorrectionReason,
  HomeDataMode,
  HomeFunctionalItem,
} from '../homeFunctionalContract.js';

export type VerificationState =
  | 'verified'
  | 'corroborated'
  | 'needs_verification'
  | 'stale'
  | 'conflict'
  | 'rejected';

export type MunicipalFunctionalRecord = {
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

export type NewsFunctionalRecord = {
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

function sourceMeta(input: {
  domain: string;
  dataMode: HomeDataMode;
  observedAt: string;
  expiresAt?: string;
}) {
  return {
    domain: input.domain,
    mode: input.dataMode,
    observedAt: input.observedAt,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  } as const;
}

function municipalRecordIsCurrent(
  record: MunicipalFunctionalRecord,
  now: Date,
): boolean {
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

export function municipalRecordsToFunctionalHome(
  input: {
    dataMode: HomeDataMode;
    observedAt: string;
    expiresAt?: string;
    records: readonly MunicipalFunctionalRecord[];
    deadlineAttentionDays?: number;
  },
  now = new Date(),
): HomeFunctionalItem[] {
  if (input.dataMode === 'unavailable') return [];
  const source = sourceMeta({
    domain: 'public-life',
    dataMode: input.dataMode,
    observedAt: input.observedAt,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  });
  const attentionMs = (input.deadlineAttentionDays ?? 3) * 24 * 60 * 60 * 1000;
  const corrections: HomeCorrectionReason[] = [
    'not_relevant',
    'incorrect_information',
  ];

  return input.records
    .filter((record) => municipalRecordIsCurrent(record, now))
    .map((record) => {
      const deadline = time(record.deadlineAt);
      const deadlineSoon =
        deadline !== undefined &&
        deadline >= now.getTime() &&
        deadline - now.getTime() <= attentionMs;
      const hasExecutableAction = Boolean(record.sourceUrl);

      const item: HomeFunctionalItem = {
        id: `public-life-${record.id}`,
        capabilityKey: deadlineSoon
          ? 'now.admin_deadline'
          : 'today.municipal_benefit',
        surface: deadlineSoon ? 'now' : 'useful_today',
        kind: deadlineSoon
          ? hasExecutableAction
            ? 'action'
            : 'alert'
          : 'useful',
        title: record.title,
        personalized: true,
        corrections,
        source,
        dedupeKey: `public-life:municipal:${record.id}`,
        importance: deadlineSoon ? 3 : 2,
        relevance: deadlineSoon ? 0.95 : 0.84,
        ...(record.summary ? { body: record.summary } : {}),
      };

      if (record.sourceUrl) {
        item.action = {
          label: deadlineSoon ? 'Ver requisitos' : 'Ver información',
          kind: 'external',
          target: record.sourceUrl,
        };
      }
      return item;
    });
}

function normalizedNewsKey(record: NewsFunctionalRecord): string {
  if (record.sourceUrl) {
    return record.sourceUrl.trim().toLowerCase().replace(/\/$/, '');
  }
  return record.title.trim().toLocaleLowerCase();
}

export function newsRecordsToFunctionalHome(
  input: {
    dataMode: HomeDataMode;
    observedAt: string;
    expiresAt?: string;
    records: readonly NewsFunctionalRecord[];
    maxAgeHours?: number;
    minimumRelevance?: number;
    maxItems?: number;
  },
  now = new Date(),
): HomeFunctionalItem[] {
  if (input.dataMode === 'unavailable') return [];

  const maxAgeMs = (input.maxAgeHours ?? 48) * 60 * 60 * 1000;
  const minimumRelevance = input.minimumRelevance ?? 0.6;
  const source = sourceMeta({
    domain: 'news',
    dataMode: input.dataMode,
    observedAt: input.observedAt,
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
  });

  const filtered = input.records.filter((record) => {
    if (!record.localityMatches || record.relevance < minimumRelevance) return false;
    const publishedAt = Date.parse(record.publishedAt);
    if (!Number.isFinite(publishedAt)) return false;
    const age = now.getTime() - publishedAt;
    return age >= 0 && age <= maxAgeMs;
  });

  const unique = new Map<string, NewsFunctionalRecord>();
  for (const record of filtered) {
    const key = normalizedNewsKey(record);
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, record);
      continue;
    }
    const existingTime = Date.parse(existing.publishedAt);
    const recordTime = Date.parse(record.publishedAt);
    if (
      record.relevance > existing.relevance ||
      (record.relevance === existing.relevance && recordTime > existingTime)
    ) {
      unique.set(key, record);
    }
  }

  return [...unique.values()]
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance;
      return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    })
    .slice(0, input.maxItems ?? 4)
    .map((record) => {
      const item: HomeFunctionalItem = {
        id: `news-${record.id}`,
        surface: 'useful_today',
        kind: 'content',
        title: record.title,
        source,
        corrections: ['not_relevant', 'incorrect_information', 'hide_type'],
        ...(record.summary ? { body: record.summary } : {}),
      };
      if (record.sourceUrl) {
        item.action = {
          label: 'Leer fuente',
          kind: 'external',
          target: record.sourceUrl,
        };
      }
      return item;
    });
}
