import type {
  PublicDataHomeRecord,
  PublicDataHomeResponse,
} from '../api/publicDataApiContract.js';
import {
  municipalRecordsToFunctionalHome,
  type MunicipalFunctionalRecord,
} from './adapters/publicLifeNewsFunctionalAdapters.js';
import type {
  HomeDataMode,
  HomeFunctionalItem,
} from './homeFunctionalContract.js';

const MUNICIPAL_HOME_TYPES = new Set([
  'benefit',
  'service',
  'procedure',
  'program',
  'notice',
]);

export type PublicDataHomeRelevanceEvaluator = (
  record: PublicDataHomeRecord,
) => boolean;

function nonEmpty(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function recordMatchesComuna(
  record: PublicDataHomeRecord,
  comunaCode: string,
): boolean {
  if (record.jurisdiction.scope === 'national') return true;
  return record.jurisdiction.comuna_codes?.includes(comunaCode) ?? false;
}

function sourceExpiry(generatedAt: string, ttlSeconds: number): string | undefined {
  const generated = Date.parse(generatedAt);
  if (!Number.isFinite(generated)) return undefined;
  return new Date(generated + Math.max(0, ttlSeconds) * 1000).toISOString();
}

function toMunicipalRecord(
  record: PublicDataHomeRecord,
  comunaCode: string,
  isRelevant: PublicDataHomeRelevanceEvaluator,
): MunicipalFunctionalRecord | null {
  if (!MUNICIPAL_HOME_TYPES.has(record.record_type)) return null;

  const summary = nonEmpty(record.summary);
  const validFrom = nonEmpty(record.validity?.starts_at);
  const validUntil = nonEmpty(record.validity?.ends_at);
  const deadlineAt = nonEmpty(record.validity?.deadline_at);
  const resolvedActionUrl = nonEmpty(record.resolved_action?.url);

  return {
    id: record.record_id,
    title: record.title,
    ...(summary ? { summary } : {}),
    // The Public Data /home endpoint is approved-only. At the Home boundary,
    // approved canonical data is represented as verified input; research or
    // hold-state records never reach this bridge.
    verification: 'verified',
    localityMatches: recordMatchesComuna(record, comunaCode),
    eligibilityRelevant: isRelevant(record),
    ...(validFrom ? { validFrom } : {}),
    ...(validUntil ? { validUntil } : {}),
    ...(deadlineAt ? { deadlineAt } : {}),
    ...(!validUntil && !deadlineAt ? { ongoing: true } : {}),
    ...(resolvedActionUrl ? { sourceUrl: resolvedActionUrl } : {}),
  };
}

/**
 * Converts approved Public Data API output into the existing Municipal Home
 * adapter. The relevance evaluator runs in the user-private layer and may use
 * consented profile state together with public `relevance_facts`; those private
 * attributes are never sent back to the Public Data API.
 */
export function publicDataHomeToFunctionalItems(input: {
  response: PublicDataHomeResponse;
  expectedComunaCode: string;
  isRelevant: PublicDataHomeRelevanceEvaluator;
  dataMode?: HomeDataMode;
  cacheTtlSeconds?: number;
  deadlineAttentionDays?: number;
  now?: Date;
}): HomeFunctionalItem[] {
  const expectedComunaCode = input.expectedComunaCode.trim();
  if (!expectedComunaCode || input.response.comuna_code !== expectedComunaCode) {
    return [];
  }

  const records = input.response.items
    .map((record) => toMunicipalRecord(record, expectedComunaCode, input.isRelevant))
    .filter((record): record is MunicipalFunctionalRecord => record !== null);
  const expiresAt = sourceExpiry(
    input.response.generated_at,
    input.cacheTtlSeconds ?? 300,
  );

  return municipalRecordsToFunctionalHome(
    {
      dataMode: input.dataMode ?? 'scheduled',
      observedAt: input.response.generated_at,
      ...(expiresAt ? { expiresAt } : {}),
      records,
      ...(input.deadlineAttentionDays !== undefined
        ? { deadlineAttentionDays: input.deadlineAttentionDays }
        : {}),
    },
    input.now ?? new Date(),
  );
}
