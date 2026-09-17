import {
  decideChileBoletaEmission,
  modelForChileTransaction,
  type ChileBoletaEmissionModelRecord,
} from '../src/fiscal/chile/boletaEmissionPolicy.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const businessId = '22222222-2222-4222-8222-222222222222';
const records: ChileBoletaEmissionModelRecord[] = [
  {
    businessId,
    model: 'voucher_replaces_boleta_for_electronic_payment',
    effectiveMonth: '2026-09',
    source: 'merchant_declared',
    recordedAt: '2026-09-17T18:00:00-03:00',
  },
  {
    businessId,
    model: 'always_issue_boleta',
    effectiveMonth: '2026-10',
    source: 'sii_verified',
    recordedAt: '2026-09-30T10:00:00-03:00',
  },
];

const septemberCard = decideChileBoletaEmission({
  businessId,
  occurredAt: '2026-09-17T20:00:00-03:00',
  paymentKind: 'electronic_voucher_eligible',
  modelRecords: records,
});
assert(
  septemberCard.action === 'do_not_issue_boleta' &&
    septemberCard.customerRepresentation === 'payment_voucher',
  'Voucher-replacement model must not emit a second consumer boleta for voucher-eligible electronic payment.',
);

const octoberCard = decideChileBoletaEmission({
  businessId,
  occurredAt: '2026-10-01T00:05:00-03:00',
  paymentKind: 'electronic_voucher_eligible',
  modelRecords: records,
});
assert(
  octoberCard.action === 'issue_boleta' &&
    octoberCard.customerRepresentation === 'boleta_and_payment_voucher',
  'Always-issue model must preserve both boleta and payment voucher representation for electronic payment.',
);

const transfer = decideChileBoletaEmission({
  businessId,
  occurredAt: '2026-09-17T20:00:00-03:00',
  paymentKind: 'bank_transfer',
  modelRecords: [],
});
assert(
  transfer.action === 'issue_boleta' && transfer.customerRepresentation === 'boleta',
  'Bank transfer must require consumer boleta issuance independently from card-voucher model selection.',
);

const cash = decideChileBoletaEmission({
  businessId,
  occurredAt: '2026-09-17T20:00:00-03:00',
  paymentKind: 'cash',
  modelRecords: [],
});
assert(cash.action === 'issue_boleta', 'Cash payment must require boleta issuance.');

const unknownElectronic = decideChileBoletaEmission({
  businessId,
  occurredAt: '2026-11-01T12:00:00-03:00',
  paymentKind: 'electronic_voucher_eligible',
  modelRecords: records,
});
assert(
  unknownElectronic.action === 'requires_configuration',
  'Palta must fail closed instead of guessing a merchant SII emission model for an uncovered month.',
);

assert(
  modelForChileTransaction({
    businessId,
    occurredAt: '2026-09-30T23:59:59-03:00',
    records,
  })?.model === 'voucher_replaces_boleta_for_electronic_payment',
  'Emission model selection must use the Chile-local transaction calendar month, not server timezone rollover.',
);

let duplicateMonthBlocked = false;
try {
  modelForChileTransaction({
    businessId,
    occurredAt: '2026-09-17T20:00:00-03:00',
    records: [...records, { ...records[0]! }],
  });
} catch {
  duplicateMonthBlocked = true;
}
assert(
  duplicateMonthBlocked,
  'Multiple emission models for the same business/month must fail closed rather than choose by array order.',
);

console.log('PASS: Chile boleta/voucher emission-model policy tests');
