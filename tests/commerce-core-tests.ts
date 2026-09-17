import {
  createCommerceTransaction,
  transitionCommerceTransaction,
} from '../src/commerce/transaction.js';
import {
  canCreateReplacementPayment,
  paymentIsAuthoritativelyPaid,
  paymentRequiresReconciliation,
} from '../src/payment/paymentPolicy.js';
import {
  attachFolio,
  createFiscalRequest,
  transitionFiscalRequest,
} from '../src/fiscal/chile/fiscalModel.js';
import {
  createOutboxEvent,
  markOutboxDelivered,
  markOutboxProcessing,
  markOutboxRetryable,
} from '../src/commerce/outbox.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const t0 = '2026-09-17T10:00:00.000Z';
const t1 = '2026-09-17T10:00:01.000Z';
const t2 = '2026-09-17T10:00:02.000Z';

let transaction = createCommerceTransaction({
  id: 'tx-1',
  businessId: 'biz-1',
  idempotencyKey: 'checkout-1',
  lines: [
    {
      id: 'line-1',
      kind: 'service',
      title: 'Jardinería',
      quantity: 1,
      unitAmountMinor: 45000,
      lineAmountMinor: 45000,
      serviceId: 'svc-garden',
    },
  ],
  createdAt: t0,
});
assert(transaction.totalAmountMinor === 45000, 'Commerce total must derive from canonical lines.');
transaction = transitionCommerceTransaction(transaction, 'ready_for_payment', t1);
transaction = transitionCommerceTransaction(transaction, 'payment_pending', t2);
assert(transaction.state === 'payment_pending', 'Commerce transaction must expose payment pending separately.');

assert(paymentRequiresReconciliation('unknown'), 'Unknown provider outcome must require reconciliation.');
assert(paymentRequiresReconciliation('processing'), 'Processing payment must require reconciliation.');
assert(!canCreateReplacementPayment('unknown'), 'Unknown payment must not permit replacement charge.');
assert(canCreateReplacementPayment('declined'), 'Declined payment may permit a replacement attempt.');
assert(paymentIsAuthoritativelyPaid('paid'), 'Only paid is authoritative payment success.');
assert(!paymentIsAuthoritativelyPaid('authorized'), 'Authorization alone is not canonical paid state.');

let fiscal = createFiscalRequest({
  id: 'fiscal-1',
  businessId: 'biz-1',
  transactionId: transaction.id,
  issuerRut: '76123456-7',
  documentType: 'boleta_39',
  idempotencyKey: 'fiscal-checkout-1',
  lines: [
    {
      id: 'fline-1',
      description: 'Jardinería',
      quantity: 1,
      unitAmountMinor: 45000,
      lineAmountMinor: 45000,
      exempt: false,
    },
  ],
  totals: {
    netAmountMinor: 37815,
    exemptAmountMinor: 0,
    vatAmountMinor: 7185,
    totalAmountMinor: 45000,
  },
  requestedAt: t0,
});
fiscal = transitionFiscalRequest(fiscal, 'validating', t1);
fiscal = transitionFiscalRequest(fiscal, 'ready_to_reserve_folio', t2);
fiscal = attachFolio(fiscal, {
  folio: 101,
  cafRef: 'caf-ref-1',
  reservedAt: '2026-09-17T10:00:03.000Z',
});
assert(fiscal.folio === 101 && fiscal.status === 'ready_to_sign', 'Validated fiscal request must own its reserved folio before signing.');

let event = createOutboxEvent({
  id: 'evt-1',
  businessId: 'biz-1',
  aggregateType: 'fiscal_request',
  aggregateId: fiscal.id,
  eventType: 'fiscal.send.requested',
  idempotencyKey: 'outbox-fiscal-1',
  payload: { fiscalRequestId: fiscal.id },
  createdAt: t0,
});
event = markOutboxProcessing(event, t1);
event = markOutboxRetryable(event, t2, '2026-09-17T10:01:00.000Z', 'SII temporarily unavailable');
event = markOutboxProcessing(event, '2026-09-17T10:01:00.000Z');
event = markOutboxDelivered(event, '2026-09-17T10:01:01.000Z');
assert(event.status === 'delivered' && event.attempts === 2, 'Outbox must preserve retry attempts and eventually deliver exactly once.');

console.log('PASS: independent commerce/payment/fiscal core tests');
