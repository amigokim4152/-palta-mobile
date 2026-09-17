export type BusinessFactField =
  | 'name'
  | 'category'
  | 'description'
  | 'address'
  | 'location'
  | 'service_area'
  | 'phone'
  | 'whatsapp'
  | 'hours'
  | 'services'
  | 'channel_link'
  | 'lifecycle';

export type BusinessFactEvidenceSource =
  | 'owner'
  | 'trusted_public_source'
  | 'system_import'
  | 'user_report'
  | 'business_activity';

export type BusinessFactEvidence = Readonly<{
  field: BusinessFactField;
  source: BusinessFactEvidenceSource;
  assertedAt: string;
  valueFingerprint?: string;
  sourceRef?: string;
}>;

export type BusinessFactAssessmentStatus =
  | 'confirmed'
  | 'corroborated'
  | 'recent_unconfirmed'
  | 'needs_confirmation'
  | 'conflict';

export type BusinessFactAssessment = Readonly<{
  status: BusinessFactAssessmentStatus;
  stale: boolean;
  latestEvidenceAt?: string;
  ownerConfirmedAt?: string;
  evidenceCount: number;
  conflictFingerprints?: readonly string[];
}>;

function toMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sourceCanConfirmField(source: BusinessFactEvidenceSource): boolean {
  return source === 'owner' || source === 'trusted_public_source';
}

function activityCanSupportField(field: BusinessFactField): boolean {
  return field === 'lifecycle';
}

/**
 * Assesses provenance without inventing truth. Freshness policy is supplied by
 * the caller because hours, address and identity facts age at different rates.
 *
 * User reports are correction signals, not automatic replacements. Generic
 * business activity may support that a Business is active, but never proves an
 * address, phone, hours or service claim.
 */
export function assessBusinessFact(input: {
  field: BusinessFactField;
  evidence: readonly BusinessFactEvidence[];
  now: string | Date;
  maxAgeMs?: number;
}): BusinessFactAssessment {
  const nowMs = input.now instanceof Date ? input.now.getTime() : Date.parse(input.now);
  if (!Number.isFinite(nowMs)) throw new Error('Business fact assessment requires a valid now');

  const relevant = input.evidence
    .filter((item) => item.field === input.field)
    .filter((item) => item.source !== 'business_activity' || activityCanSupportField(input.field))
    .map((item) => ({ item, at: toMs(item.assertedAt) }))
    .filter((entry): entry is { item: BusinessFactEvidence; at: number } => entry.at !== null)
    .sort((a, b) => b.at - a.at);

  const isFresh = (at: number): boolean =>
    input.maxAgeMs === undefined || nowMs - at <= input.maxAgeMs;

  const latest = relevant[0];
  const latestIsFresh = Boolean(latest && isFresh(latest.at));
  const owner = relevant.find((entry) => entry.item.source === 'owner');
  const ownerIsFresh = Boolean(owner && isFresh(owner.at));
  const confirming = relevant.filter((entry) => sourceCanConfirmField(entry.item.source));
  const freshConfirming = confirming.filter((entry) => isFresh(entry.at));
  const freshConfirmingFingerprints = [...new Set(
    freshConfirming
      .map((entry) => entry.item.valueFingerprint?.trim())
      .filter((value): value is string => Boolean(value)),
  )];

  const conflict = freshConfirmingFingerprints.length > 1;
  if (conflict) {
    return {
      status: 'conflict',
      stale: false,
      ...(latest ? { latestEvidenceAt: latest.item.assertedAt } : {}),
      ...(owner ? { ownerConfirmedAt: owner.item.assertedAt } : {}),
      evidenceCount: relevant.length,
      conflictFingerprints: freshConfirmingFingerprints,
    };
  }

  if (owner && ownerIsFresh) {
    return {
      status: 'confirmed',
      stale: false,
      latestEvidenceAt: latest?.item.assertedAt ?? owner.item.assertedAt,
      ownerConfirmedAt: owner.item.assertedAt,
      evidenceCount: relevant.length,
    };
  }

  if (freshConfirming.length >= 2 && freshConfirmingFingerprints.length <= 1) {
    return {
      status: 'corroborated',
      stale: false,
      ...(latest ? { latestEvidenceAt: latest.item.assertedAt } : {}),
      evidenceCount: relevant.length,
    };
  }

  if (latest && latestIsFresh) {
    return {
      status: 'recent_unconfirmed',
      stale: false,
      latestEvidenceAt: latest.item.assertedAt,
      ...(owner ? { ownerConfirmedAt: owner.item.assertedAt } : {}),
      evidenceCount: relevant.length,
    };
  }

  return {
    status: 'needs_confirmation',
    stale: true,
    ...(latest ? { latestEvidenceAt: latest.item.assertedAt } : {}),
    ...(owner ? { ownerConfirmedAt: owner.item.assertedAt } : {}),
    evidenceCount: relevant.length,
  };
}

/**
 * A user report can flag a possible correction but cannot silently overwrite a
 * canonical Business fact. Owner/trusted evidence may update facts through the
 * domain's normal moderation/verification path.
 */
export function evidenceMayAutoApply(input: {
  field: BusinessFactField;
  source: BusinessFactEvidenceSource;
}): boolean {
  if (input.source === 'user_report') return false;
  if (input.source === 'business_activity') return input.field === 'lifecycle';
  return input.source === 'owner' || input.source === 'trusted_public_source';
}
