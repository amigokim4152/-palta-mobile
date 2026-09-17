import {
  createCommerceTransaction,
  transitionCommerceTransaction,
} from '../src/commerce/transaction.js';
import {
  appendCashDrawerEntry,
  closePOSSession,
  createCashDrawerEntry,
  createPOSRegister,
  openPOSSession,
} from '../src/commerce/posSession.js';
import {
  decideCommerceRuntimeOperation,
  type CommerceRuntimePolicyInput,
} from '../src/commerce/runtimePolicy.js';
import { paymentIncident } from '../src/payment/paymentIncident.js';
import {
  canCreateReplacementPayment,
  paymentIsAuthoritativelyPaid,
  paymentRequiresOperatorAction,
  paymentRequiresReconciliation,
} from '../src/payment/paymentPolicy.js';
import {
  attachFolio,
  createFiscalRequest,
  transitionFiscalRequest,
} from '../src/fiscal/chile/fiscalModel.js';
import {
  reserveNextFolioInState,
} from '../src/fiscal/chile/folioStore.js';
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
assert(transaction.revision === 0, 'New commerce transaction must start at revision zero.');
transaction = transitionCommerceTransaction(transaction, 'ready_for_payment', t1);
transaction = transitionCommerceTransaction(transaction, 'payment_pending', t2);
assert(transaction.state === 'payment_pending', 'Commerce transaction must expose payment pending separately.');
assert(transaction.revision === 2, 'Every canonical commerce mutation must advance revision.');

const mobileRegister = createPOSRegister({
  id: 'register-mobile-1',
  businessId: 'biz-gardener',
  name: 'Mi teléfono',
});
const mobileSession = openPOSSession({
  id: 'session-mobile-1',
  register: mobileRegister,
  operatorId: 'owner-1',
  openedAt: t0,
});
const closedMobileSession = closePOSSession({
  session: mobileSession,
  closedAt: t2,
  closedBy: 'owner-1',
});
assert(
  closedMobileSession.status === 'closed' &&
    closedMobileSession.cashControl === 'none' &&
    closedMobileSession.countedCashMinor === undefined,
  'Mobile micro-service POS must work without forcing a cash-drawer count.',
);

const shopRegister = createPOSRegister({
  id: 'register-shop-1',
  businessId: 'biz-shop',
  name: 'Caja 1',
  cashControl: 'tracked',
});
let shopSession = openPOSSession({
  id: 'session-shop-1',
  register: shopRegister,
  operatorId: 'cashier-1',
  openedAt: t0,
  openingCashMinor: 20000,
});
const cashSale = createCashDrawerEntry({
  id: 'cash-entry-1',
  session: shopSession,
  type: 'cash_sale',
  amountMinor: 45000,
  occurredAt: t1,
  idempotencyKey: 'cash-sale-tx-1',
  referenceId: 'tx-1',
});
shopSession = appendCashDrawerEntry(shopSession, cashSale);
shopSession = appendCashDrawerEntry(shopSession, cashSale);
const closedShopSession = closePOSSession({
  session: shopSession,
  closedAt: t2,
  closedBy: 'manager-1',
  countedCashMinor: 64000,
});
assert(
  closedShopSession.expectedCashMinor === 65000 &&
    closedShopSession.cashDifferenceMinor === -1000 &&
    closedShopSession.cashEntries.length === 1,
  'Tracked Caja must compute expected cash and ignore duplicate cash events idempotently.',
);

assert(paymentRequiresReconciliation('unknown'), 'Unknown provider outcome must require reconciliation.');
assert(paymentRequiresReconciliation('processing'), 'Processing payment must require reconciliation.');
assert(paymentRequiresReconciliation('requires_action'), 'Operator-action payment must remain blocked from replacement until resolved.');
assert(paymentRequiresOperatorAction('requires_action'), 'Requires-action state must explicitly route to operator/terminal handling.');
assert(!canCreateReplacementPayment('unknown'), 'Unknown payment must not permit replacement charge.');
assert(!canCreateReplacementPayment('requires_action'), 'Terminal action-required payment must not permit replacement charge.');
assert(canCreateReplacementPayment('declined'), 'Declined payment may permit a replacement attempt.');
assert(paymentIsAuthoritativelyPaid('paid'), 'Only paid is authoritative payment success.');
assert(!paymentIsAuthoritativelyPaid('authorized'), 'Authorization alone is not canonical paid state.');

const unknownIncident = paymentIncident('outcome_unknown');
assert(
  unknownIncident.requiresReconciliation &&
    !unknownIncident.replacementPaymentAllowed &&
    !unknownIncident.automaticRetryAllowed,
  'Unknown payment outcomes must never auto-retry or allow replacement before reconciliation.',
);
const transientIncident = paymentIncident('transient_provider_error');
assert(
  transientIncident.automaticRetryAllowed &&
    transientIncident.recovery === 'retry_same_operation_same_key' &&
    !transientIncident.replacementPaymentAllowed,
  'Transient provider errors may retry only the same operation identity, never create a replacement charge.',
);
const busyIncident = paymentIncident('terminal_busy');
assert(
  busyIncident.recovery === 'operator_check_terminal' &&
    busyIncident.userState === 'terminal_busy_finish_previous_payment',
  'Busy terminals must route to previous-payment resolution rather than generic retry.',
);

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

const folioRequest = {
  businessId: 'biz-1',
  issuerRut: '76123456-7',
  documentType: 'boleta_39' as const,
  fiscalRequestId: fiscal.id,
  idempotencyKey: fiscal.idempotencyKey,
};
const firstAllocation = reserveNextFolioInState({
  range: {
    businessId: 'biz-1',
    issuerRut: '76123456-7',
    documentType: 'boleta_39',
    cafRef: 'caf-ref-1',
    firstFolio: 101,
    lastFolio: 102,
    nextFolio: 101,
    revision: 0,
    status: 'active',
  },
  request: folioRequest,
  reservedAt: '2026-09-17T10:00:03.000Z',
});
assert(
  firstAllocation.reservation.folio === 101 &&
    firstAllocation.range.nextFolio === 102 &&
    firstAllocation.range.revision === 1 &&
    firstAllocation.reused === false,
  'Atomic folio allocation must reserve once and advance the CAF range revision.',
);
const replayedAllocation = reserveNextFolioInState({
  range: firstAllocation.range,
  request: folioRequest,
  existingReservation: firstAllocation.reservation,
  reservedAt: '2026-09-17T10:00:04.000Z',
});
assert(
  replayedAllocation.reservation.folio === 101 &&
    replayedAllocation.range.revision === 1 &&
    replayedAllocation.reused === true,
  'Idempotent fiscal retry must reuse the original folio without consuming another one.',
);

fiscal = attachFolio(fiscal, replayedAllocation.reservation);
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

const healthyRuntime: CommerceRuntimePolicyInput = {
  dependencies: {
    database: 'healthy',
    asyncQueue: 'healthy',
    paymentProvider: 'healthy',
    sii: 'healthy',
    objectStorage: 'healthy',
    localJournal: 'healthy',
  },
  offlineManualSalesAllowed: true,
  fiscalDeferralAllowed: true,
};

const queueOutagePayment = decideCommerceRuntimeOperation('integrated_payment', {
  ...healthyRuntime,
  dependencies: { ...healthyRuntime.dependencies, asyncQueue: 'unavailable' },
});
assert(
  queueOutagePayment.decision === 'allow_degraded' &&
    queueOutagePayment.reason === 'queue_degraded_outbox_durable',
  'Queue outage must not block an integrated payment when DB Outbox remains durable.',
);

const dbOutageCard = decideCommerceRuntimeOperation('integrated_payment', {
  ...healthyRuntime,
  dependencies: { ...healthyRuntime.dependencies, database: 'unavailable' },
});
assert(
  dbOutageCard.decision === 'block',
  'Integrated payment must not start when canonical payment state cannot be durably stored.',
);

const dbOutageCash = decideCommerceRuntimeOperation('manual_payment_record', {
  ...healthyRuntime,
  dependencies: { ...healthyRuntime.dependencies, database: 'unavailable' },
});
assert(
  dbOutageCash.decision === 'allow_degraded' &&
    dbOutageCash.userState === 'saved_locally_pending_sync',
  'Manual/cash operation may continue through the local journal when offline policy permits it.',
);

const siiOutageDeferred = decideCommerceRuntimeOperation('fiscal_send', {
  ...healthyRuntime,
  dependencies: { ...healthyRuntime.dependencies, sii: 'unavailable' },
});
assert(
  siiOutageDeferred.decision === 'allow_degraded' &&
    siiOutageDeferred.userState === 'fiscal_pending',
  'SII outage must become fiscal pending when the Chile Fiscal layer explicitly permits deferral.',
);

const siiOutageBlocking = decideCommerceRuntimeOperation('fiscal_send', {
  ...healthyRuntime,
  fiscalDeferralAllowed: false,
  dependencies: { ...healthyRuntime.dependencies, sii: 'unavailable' },
});
assert(
  siiOutageBlocking.decision === 'block',
  'Core must not invent fiscal deferral when the Chile Fiscal layer says it is not allowed.',
);

const archiveOutage = decideCommerceRuntimeOperation('fiscal_archive', {
  ...healthyRuntime,
  dependencies: { ...healthyRuntime.dependencies, objectStorage: 'unavailable' },
});
assert(
  archiveOutage.decision === 'allow_degraded' &&
    archiveOutage.userState === 'fiscal_archive_pending',
  'Archive outage should create a monitored backlog rather than roll back the commercial transaction.',
);

console.log('PASS: independent commerce/payment/fiscal/POS/runtime core tests');
