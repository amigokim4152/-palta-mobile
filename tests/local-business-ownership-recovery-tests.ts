import {
  assessOwnershipRecovery,
  nextOwnershipRecoveryStatus,
  validateOwnershipRecoveryRequest,
  type BusinessOwnershipRecoveryRequest,
} from '../src/business/businessOwnershipRecovery.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const base: BusinessOwnershipRecoveryRequest = {
  id: 'recovery-1',
  businessId: 'biz-1',
  requesterUserId: 'user-1',
  reason: 'lost_access',
  status: 'pending_verification',
  requestedAt: '2026-09-17T12:00:00-03:00',
  evidence: [],
};

assert(validateOwnershipRecoveryRequest(base).length === 0, 'valid recovery request should pass');

const noEvidence = assessOwnershipRecovery({
  request: base,
  businessExists: true,
  currentManagerExists: true,
});
assert(noEvidence.maySubmit, 'legitimate recovery request may enter verification');
assert(!noEvidence.mayGrantAccess, 'self-asserted recovery must not immediately grant access');
assert(noEvidence.needsManualReview, 'existing manager should force careful review');

const oneWeakSignal = assessOwnershipRecovery({
  request: {
    ...base,
    evidence: [
      {
        kind: 'business_phone_challenge',
        ref: 'verification:phone-1',
        verifiedAt: '2026-09-17T12:05:00-03:00',
      },
    ],
  },
  businessExists: true,
  currentManagerExists: false,
});
assert(!oneWeakSignal.mayGrantAccess, 'one channel challenge alone must not grant ownership');

const strongEvidence = assessOwnershipRecovery({
  request: {
    ...base,
    evidence: [
      {
        kind: 'business_phone_challenge',
        ref: 'verification:phone-1',
        verifiedAt: '2026-09-17T12:05:00-03:00',
      },
      {
        kind: 'sii_business_document',
        ref: 'document:sii-1',
        verifiedAt: '2026-09-17T12:10:00-03:00',
      },
    ],
  },
  businessExists: true,
  currentManagerExists: false,
});
assert(strongEvidence.mayGrantAccess, 'verified business channel plus verified business document may support access grant');
assert(!strongEvidence.needsManualReview, 'strong evidence without conflicting manager can proceed without forced manual review');

const incorrectClaim = assessOwnershipRecovery({
  request: {
    ...base,
    reason: 'incorrect_claim',
    evidence: [
      {
        kind: 'trusted_manual_review',
        ref: 'verification:manual-1',
        verifiedAt: '2026-09-17T12:15:00-03:00',
      },
    ],
  },
  businessExists: true,
  currentManagerExists: true,
});
assert(incorrectClaim.mayGrantAccess, 'trusted review can establish strong evidence');
assert(incorrectClaim.needsManualReview, 'incorrect-claim dispute must remain manually reviewed');

assert(
  nextOwnershipRecoveryStatus({
    request: base,
    businessExists: true,
    currentManagerExists: true,
  }) === 'pending_verification',
  'empty valid recovery should enter verification rather than create a duplicate business',
);

assert(
  nextOwnershipRecoveryStatus({
    request: { ...base, evidence: strongEvidence.mayGrantAccess ? [
      {
        kind: 'business_email_challenge',
        ref: 'verification:email-1',
        verifiedAt: '2026-09-17T12:20:00-03:00',
      },
      {
        kind: 'legal_representative_document',
        ref: 'document:legal-1',
        verifiedAt: '2026-09-17T12:25:00-03:00',
      },
    ] : [] },
    businessExists: true,
    currentManagerExists: false,
  }) === 'approved',
  'strong verified evidence without conflict may approve recovery',
);

console.log('PASS: Local Business ownership recovery safeguards');
