import {
  evidenceMayAutoApply,
  type BusinessFactEvidence,
  type BusinessFactField,
} from './businessFactEvidence.js';

export type BusinessFactCorrectionReason =
  | 'wrong_value'
  | 'outdated'
  | 'temporarily_changed'
  | 'business_moved'
  | 'business_closed'
  | 'other';

export type BusinessFactCorrectionStatus =
  | 'submitted'
  | 'awaiting_owner_review'
  | 'awaiting_trusted_review'
  | 'accepted'
  | 'rejected'
  | 'superseded';

export type BusinessFactCorrection = Readonly<{
  id: string;
  businessId: string;
  field: BusinessFactField;
  reason: BusinessFactCorrectionReason;
  reportedAt: string;
  status: BusinessFactCorrectionStatus;
  proposedValueFingerprint?: string;
  note?: string;
  moderationRef?: string;
}>;

export type BusinessFactCorrectionQueueTarget =
  | 'owner_review'
  | 'trusted_review';

function validInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function validateBusinessFactCorrection(
  correction: BusinessFactCorrection,
): readonly string[] {
  const issues: string[] = [];
  if (!correction.id.trim()) issues.push('correction_id_required');
  if (!correction.businessId.trim()) issues.push('business_id_required');
  if (!validInstant(correction.reportedAt)) issues.push('reported_at_invalid');
  if ((correction.note ?? '').length > 1000) issues.push('correction_note_too_long');
  if ((correction.proposedValueFingerprint ?? '').length > 256) {
    issues.push('correction_fingerprint_too_long');
  }
  return issues;
}

/**
 * Local Business owns the semantic correction signal, not the moderation
 * engine. Claimed/verified businesses can review ordinary fact corrections;
 * unclaimed businesses require a trusted/public-data review path.
 */
export function correctionQueueTarget(input: {
  ownerManaged: boolean;
}): BusinessFactCorrectionQueueTarget {
  return input.ownerManaged ? 'owner_review' : 'trusted_review';
}

/**
 * Converts a submitted correction into provenance evidence. It intentionally
 * remains `user_report`, which businessFactEvidence never auto-applies.
 */
export function correctionToEvidence(
  correction: BusinessFactCorrection,
): BusinessFactEvidence {
  const issues = validateBusinessFactCorrection(correction);
  if (issues.length) throw new Error(`Invalid Business fact correction: ${issues.join(',')}`);
  return {
    field: correction.field,
    source: 'user_report',
    assertedAt: correction.reportedAt,
    ...(correction.proposedValueFingerprint?.trim()
      ? { valueFingerprint: correction.proposedValueFingerprint.trim() }
      : {}),
    sourceRef: `business-correction:${correction.id}`,
  };
}

export function correctionMayAutoApply(
  correction: BusinessFactCorrection,
): boolean {
  if (validateBusinessFactCorrection(correction).length) return false;
  return evidenceMayAutoApply({ field: correction.field, source: 'user_report' });
}

/**
 * Multiple reports can raise review priority, but report volume alone never
 * turns a value into canonical truth. The caller may use this priority only to
 * order human/trusted review work.
 */
export function correctionReviewPriority(input: {
  corrections: readonly BusinessFactCorrection[];
  field: BusinessFactField;
  now: string | Date;
  recentWindowMs: number;
}): number {
  const nowMs = input.now instanceof Date ? input.now.getTime() : Date.parse(input.now);
  if (!Number.isFinite(nowMs) || input.recentWindowMs < 0) {
    throw new Error('Invalid correction review priority clock/window');
  }

  const recent = input.corrections.filter((correction) => {
    if (correction.field !== input.field) return false;
    if (correction.status === 'rejected' || correction.status === 'superseded') return false;
    const at = Date.parse(correction.reportedAt);
    return Number.isFinite(at) && nowMs - at >= 0 && nowMs - at <= input.recentWindowMs;
  });

  return Math.min(100, recent.length * 10);
}
