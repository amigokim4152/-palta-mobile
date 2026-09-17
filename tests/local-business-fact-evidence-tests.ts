import {
  assessBusinessFact,
  evidenceMayAutoApply,
  type BusinessFactEvidence,
} from '../src/business/businessFactEvidence.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ownerHours: BusinessFactEvidence[] = [
  {
    field: 'hours',
    source: 'owner',
    assertedAt: '2026-09-10T12:00:00-03:00',
    valueFingerprint: 'hours:v2',
    sourceRef: 'owner-confirmation:biz-1',
  },
];
const confirmedHours = assessBusinessFact({
  field: 'hours',
  evidence: ownerHours,
  now: '2026-09-17T12:00:00-03:00',
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
});
assert(confirmedHours.status === 'confirmed', 'Recent owner-confirmed hours should be confirmed.');
assert(!confirmedHours.stale, 'Recent owner-confirmed hours should not be stale.');

const staleHours = assessBusinessFact({
  field: 'hours',
  evidence: ownerHours,
  now: '2027-03-17T12:00:00-03:00',
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
});
assert(staleHours.status === 'needs_confirmation', 'Old hours should ask for confirmation instead of pretending they remain current.');
assert(staleHours.stale, 'Caller-provided freshness policy should mark old hours stale.');

const staleOwnerPlusFreshReport = assessBusinessFact({
  field: 'hours',
  evidence: [
    {
      field: 'hours',
      source: 'owner',
      assertedAt: '2026-01-01T12:00:00-03:00',
      valueFingerprint: 'hours:old-owner',
    },
    {
      field: 'hours',
      source: 'user_report',
      assertedAt: '2026-09-17T11:00:00-03:00',
      valueFingerprint: 'hours:reported-change',
    },
  ],
  now: '2026-09-17T12:00:00-03:00',
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
});
assert(
  staleOwnerPlusFreshReport.status === 'recent_unconfirmed',
  'A fresh user report must not refresh an expired owner confirmation into confirmed truth.',
);
assert(
  staleOwnerPlusFreshReport.ownerConfirmedAt === '2026-01-01T12:00:00-03:00',
  'The old owner confirmation should remain visible as provenance without becoming fresh.',
);

const correctionReport: BusinessFactEvidence[] = [
  {
    field: 'address',
    source: 'user_report',
    assertedAt: '2026-09-17T11:00:00-03:00',
    valueFingerprint: 'address:new-place',
    sourceRef: 'report:123',
  },
];
const reportedAddress = assessBusinessFact({
  field: 'address',
  evidence: correctionReport,
  now: '2026-09-17T12:00:00-03:00',
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
});
assert(reportedAddress.status === 'recent_unconfirmed', 'A fresh user report is a useful signal but not canonical truth.');
assert(!evidenceMayAutoApply({ field: 'address', source: 'user_report' }), 'User reports must not silently overwrite canonical address data.');

const activity: BusinessFactEvidence[] = [
  {
    field: 'lifecycle',
    source: 'business_activity',
    assertedAt: '2026-09-17T10:00:00-03:00',
    sourceRef: 'business-post:post-1',
  },
  {
    field: 'hours',
    source: 'business_activity',
    assertedAt: '2026-09-17T10:00:00-03:00',
    sourceRef: 'business-post:post-1',
  },
];
const lifecycle = assessBusinessFact({
  field: 'lifecycle',
  evidence: activity,
  now: '2026-09-17T12:00:00-03:00',
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
});
assert(lifecycle.status === 'recent_unconfirmed', 'Recent business activity may support lifecycle recency.');
const activityHours = assessBusinessFact({
  field: 'hours',
  evidence: activity,
  now: '2026-09-17T12:00:00-03:00',
  maxAgeMs: 30 * 24 * 60 * 60 * 1000,
});
assert(activityHours.status === 'needs_confirmation', 'A post or transaction must not prove unrelated opening hours.');
assert(evidenceMayAutoApply({ field: 'lifecycle', source: 'business_activity' }), 'Business activity may update only lifecycle evidence.');
assert(!evidenceMayAutoApply({ field: 'hours', source: 'business_activity' }), 'Business activity must not auto-apply to hours.');

const conflict = assessBusinessFact({
  field: 'phone',
  evidence: [
    {
      field: 'phone',
      source: 'owner',
      assertedAt: '2026-09-16T10:00:00-03:00',
      valueFingerprint: 'phone:owner',
    },
    {
      field: 'phone',
      source: 'trusted_public_source',
      assertedAt: '2026-09-17T10:00:00-03:00',
      valueFingerprint: 'phone:public',
    },
  ],
  now: '2026-09-17T12:00:00-03:00',
  maxAgeMs: 180 * 24 * 60 * 60 * 1000,
});
assert(conflict.status === 'conflict', 'Conflicting confirming sources must surface a conflict instead of silently choosing one.');
assert(conflict.conflictFingerprints?.length === 2, 'Conflict assessment should preserve the distinct evidence fingerprints.');

console.log('PASS: Local Business fact provenance and freshness');
