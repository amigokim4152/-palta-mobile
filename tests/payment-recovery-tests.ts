import {
  paymentTransitionAllowed,
  transitionPaymentIntent,
  type PaymentIntent,
} from '../src/payment/paymentModel.js';
import {
  planPaymentRecovery,
  reconcilePaymentOutcome,
} from '../src/payment/paymentRecovery.js';
import type {
  CreatePaymentInput,
  PaymentPort,
} from '../src/ports/paymentPort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function payment(status: PaymentIntent['status'], providerReference?: string): PaymentIntent {
  const intent: PaymentIntent = {
    id: 'pay-1',
    orderId: 'order-1',
    commerceTransactionId: 'tx-1',
    merchantId: 'biz-1',
    amount: { currency: 'CLP', amountMinor: 45000 },
    rail: 'card',
    status,
    revision: 0,
    providerKey: 'provider-test',
    settlementStatus: 'not_applicable',
    idempotencyKey: 'idem-pay-1',
    createdAt: '2026-09-17T10:00:00.000Z',
    updatedAt: '2026-09-17T10:00:01.000Z',
  };
  if (providerReference !== undefined) intent.providerReference = providerReference;
  return intent;
}

const originalRequest: CreatePaymentInput = {
  canonicalPaymentId: 'pay-1',
  canonicalCommerceTransactionId: 'tx-1',
  canonicalOrderId: 'order-1',
  canonicalMerchantId: 'biz-1',
  amount: { currency: 'CLP', amountMinor: 45000 },
  rail: 'card',
  idempotencyKey: 'idem-pay-1',
  terminalId: 'terminal-1',
};

const basicPort: PaymentPort = {
  providerKey: 'provider-basic',
  supportsRail: (rail) => rail === 'card',
  async createPayment() {
    return {
      providerKey: 'provider-basic',
      providerReference: 'ref-created',
      status: 'pending',
    };
  },
  async getStatus(providerReference) {
    return {
      providerKey: 'provider-basic',
      providerReference,
      status: 'paid',
    };
  },
  async refund(input) {
    return {
      providerKey: 'provider-basic',
      providerReference: input.providerReference,
      status: 'refunded',
    };
  },
};

let providerReconcileCalls = 0;
const recoverablePort: PaymentPort = {
  ...basicPort,
  providerKey: 'provider-recoverable',
  async reconcilePayment(input) {
    providerReconcileCalls += 1;
    return {
      providerKey: 'provider-recoverable',
      providerReference: input.providerReference ?? 'ref-recovered',
      status: 'paid',
    };
  },
};

const knownReferencePlan = planPaymentRecovery(payment('unknown', 'ref-1'), basicPort);
assert(
  knownReferencePlan.mode === 'status_lookup' &&
    knownReferencePlan.replacementPaymentAllowed === false,
  'Unknown payment with provider reference must use status lookup before replacement payment.',
);

const responseLossPlan = planPaymentRecovery(payment('unknown'), recoverablePort);
assert(
  responseLossPlan.mode === 'provider_reconcile' &&
    responseLossPlan.replacementPaymentAllowed === false,
  'Response-loss payment without provider reference must use provider-specific reconciliation when available.',
);

const manualPlan = planPaymentRecovery(payment('unknown'), basicPort);
assert(
  manualPlan.mode === 'manual_review',
  'Provider without response-loss recovery must not fabricate a retry path.',
);

const actionPlan = planPaymentRecovery(payment('requires_action', 'ref-action'), recoverablePort);
assert(
  actionPlan.mode === 'operator_action' &&
    actionPlan.userState === 'check_terminal_for_final_status',
  'requires_action must route to operator/terminal resolution before another payment.',
);

const declinedPlan = planPaymentRecovery(payment('declined', 'ref-declined'), basicPort);
assert(
  declinedPlan.mode === 'none' && declinedPlan.replacementPaymentAllowed === true,
  'Authoritative decline may allow a new payment attempt.',
);

const lookedUp = await reconcilePaymentOutcome({
  intent: payment('processing', 'ref-status'),
  port: basicPort,
  originalRequest,
});
assert(
  lookedUp.status === 'paid' && lookedUp.providerReference === 'ref-status',
  'Known provider reference must reconcile through status lookup.',
);

const recovered = await reconcilePaymentOutcome({
  intent: payment('unknown'),
  port: recoverablePort,
  originalRequest,
});
assert(
  recovered.status === 'paid' &&
    recovered.providerReference === 'ref-recovered' &&
    providerReconcileCalls === 1,
  'Provider response-loss recovery must reuse the original canonical payment identity.',
);

let actionBlocked = false;
try {
  await reconcilePaymentOutcome({
    intent: payment('requires_action', 'ref-action'),
    port: recoverablePort,
    originalRequest,
  });
} catch {
  actionBlocked = true;
}
assert(actionBlocked, 'Operator-action payment must not be silently auto-retried.');

const paidIntent = transitionPaymentIntent(
  payment('processing', 'ref-paid'),
  'paid',
  '2026-09-17T10:00:02.000Z',
);
assert(
  paidIntent.status === 'paid' && paidIntent.revision === 1,
  'Authoritative payment transition must advance optimistic revision.',
);
assert(
  paymentTransitionAllowed('paid', 'processing') === false,
  'Late provider callbacks must not regress a paid payment back to processing.',
);
let staleRegressionBlocked = false;
try {
  transitionPaymentIntent(
    paidIntent,
    'processing',
    '2026-09-17T10:00:03.000Z',
  );
} catch {
  staleRegressionBlocked = true;
}
assert(staleRegressionBlocked, 'Stale callback regression must be rejected by canonical payment state machine.');

console.log('PASS: canonical payment recovery orchestration tests');
