import {
  correctionMayAutoApply,
  correctionQueueTarget,
  correctionReviewPriority,
  correctionToEvidence,
  type BusinessFactCorrection,
} from '../src/business/businessFactCorrection.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const hoursCorrection: BusinessFactCorrection = {
  id: 'corr-1',
  businessId: 'biz-cafe-1',
  field: 'hours',
  reason: 'outdated',
  reportedAt: '2026-09-17T12:00:00-03:00',
  status: 'awaiting_owner_review',
  proposedValueFingerprint: 'hours:reported-v3',
  note: 'Hoy estaba cerrado aunque el perfil decía abierto.',
};

const evidence = correctionToEvidence(hoursCorrection);
assert(evidence.source === 'user_report', 'A customer correction must remain user-report evidence until reviewed.');
assert(evidence.field === 'hours', 'Correction evidence must remain scoped to the reported fact field.');
assert(!correctionMayAutoApply(hoursCorrection), 'A customer correction must never silently overwrite canonical Business truth.');
assert(correctionQueueTarget({ ownerManaged: true }) === 'owner_review', 'Claimed businesses should receive ordinary fact corrections for owner review.');
assert(correctionQueueTarget({ ownerManaged: false }) === 'trusted_review', 'Unclaimed businesses need a trusted review path rather than an absent owner workflow.');

const reports: BusinessFactCorrection[] = [
  hoursCorrection,
  {
    ...hoursCorrection,
    id: 'corr-2',
    reportedAt: '2026-09-17T12:10:00-03:00',
    status: 'submitted',
  },
  {
    ...hoursCorrection,
    id: 'corr-rejected',
    reportedAt: '2026-09-17T12:20:00-03:00',
    status: 'rejected',
  },
];
const priority = correctionReviewPriority({
  corrections: reports,
  field: 'hours',
  now: '2026-09-17T13:00:00-03:00',
  recentWindowMs: 24 * 60 * 60 * 1000,
});
assert(priority === 20, 'Multiple recent non-rejected reports may raise review priority without changing canonical truth.');

console.log('PASS: Local Business fact correction signals');
