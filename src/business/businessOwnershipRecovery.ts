export type BusinessOwnershipRecoveryReason =
  | 'lost_access'
  | 'prior_manager_left'
  | 'incorrect_claim'
  | 'ownership_transfer';

export type BusinessOwnershipEvidenceKind =
  | 'business_phone_challenge'
  | 'business_email_challenge'
  | 'sii_business_document'
  | 'legal_representative_document'
  | 'storefront_evidence'
  | 'trusted_manual_review';

export type BusinessOwnershipEvidenceRef = Readonly<{
  kind: BusinessOwnershipEvidenceKind;
  ref: string;
  verifiedAt?: string;
}>;

export type BusinessOwnershipRecoveryStatus =
  | 'draft'
  | 'pending_verification'
  | 'needs_more_evidence'
  | 'approved'
  | 'rejected'
  | 'cancelled';

export type BusinessOwnershipRecoveryRequest = Readonly<{
  id: string;
  businessId: string;
  requesterUserId: string;
  reason: BusinessOwnershipRecoveryReason;
  status: BusinessOwnershipRecoveryStatus;
  requestedAt: string;
  evidence: readonly BusinessOwnershipEvidenceRef[];
  verificationCaseRef?: string;
}>;

export type BusinessOwnershipRecoveryAssessment = Readonly<{
  maySubmit: boolean;
  mayGrantAccess: boolean;
  needsManualReview: boolean;
  issues: readonly string[];
}>;

function validInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function validateOwnershipRecoveryRequest(
  request: BusinessOwnershipRecoveryRequest,
): readonly string[] {
  const issues: string[] = [];
  if (!request.id.trim()) issues.push('recovery_id_required');
  if (!request.businessId.trim()) issues.push('business_id_required');
  if (!request.requesterUserId.trim()) issues.push('requester_user_id_required');
  if (!validInstant(request.requestedAt)) issues.push('requested_at_invalid');
  for (const item of request.evidence) {
    if (!item.ref.trim()) issues.push('evidence_ref_required');
    if (item.verifiedAt && !validInstant(item.verifiedAt)) {
      issues.push('evidence_verified_at_invalid');
    }
  }
  return [...new Set(issues)];
}

/**
 * Local Business never decides ownership from a single self-asserted signal.
 * It only assesses whether a recovery request can enter verification and
 * whether already-verified evidence is strong enough for the shared
 * Verification/Authorization layer to consider granting access.
 */
export function assessOwnershipRecovery(input: {
  request: BusinessOwnershipRecoveryRequest;
  businessExists: boolean;
  currentManagerExists: boolean;
}): BusinessOwnershipRecoveryAssessment {
  const issues = [...validateOwnershipRecoveryRequest(input.request)];
  if (!input.businessExists) issues.push('business_not_found');

  const verified = input.request.evidence.filter(
    (item) => item.verifiedAt && validInstant(item.verifiedAt),
  );
  const verifiedKinds = new Set(verified.map((item) => item.kind));

  const hasBusinessChannel =
    verifiedKinds.has('business_phone_challenge') ||
    verifiedKinds.has('business_email_challenge');
  const hasDocument =
    verifiedKinds.has('sii_business_document') ||
    verifiedKinds.has('legal_representative_document');
  const hasTrustedManualReview = verifiedKinds.has('trusted_manual_review');

  const maySubmit = issues.length === 0;
  const strongerEvidence = (hasBusinessChannel && hasDocument) || hasTrustedManualReview;

  return {
    maySubmit,
    mayGrantAccess: maySubmit && strongerEvidence,
    needsManualReview:
      maySubmit &&
      (input.currentManagerExists || input.request.reason === 'incorrect_claim' || !strongerEvidence),
    issues,
  };
}

export function nextOwnershipRecoveryStatus(input: {
  request: BusinessOwnershipRecoveryRequest;
  businessExists: boolean;
  currentManagerExists: boolean;
}): BusinessOwnershipRecoveryStatus {
  const assessment = assessOwnershipRecovery(input);
  if (!assessment.maySubmit) return 'rejected';
  if (assessment.mayGrantAccess && !assessment.needsManualReview) return 'approved';
  if (assessment.mayGrantAccess) return 'pending_verification';
  return input.request.evidence.length ? 'needs_more_evidence' : 'pending_verification';
}
