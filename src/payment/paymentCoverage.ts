import type { CommerceTransactionState } from '../commerce/transaction.js';
import { assertMinorAmount, type CommerceTransaction } from '../commerce/transaction.js';
import type { PaymentIntent, PaymentStatus } from './paymentModel.js';

const UNRESOLVED_PAYMENT_STATUSES = new Set<PaymentStatus>([
  'created',
  'pending',
  'processing',
  'requires_action',
  'authorized',
  'unknown',
]);

const TERMINAL_UNPAID_STATUSES = new Set<PaymentStatus>([
  'declined',
  'failed',
  'cancelled',
]);

const REFUND_LIFECYCLE_STATUSES = new Set<PaymentStatus>([
  'refund_pending',
  'partially_refunded',
  'refunded',
]);

export type PaymentCoverage = {
  transactionId: string;
  totalAmountMinor: number;
  paidAmountMinor: number;
  unresolvedAmountMinor: number;
  potentialExposureMinor: number;
  remainingAfterPaidMinor: number;
  unallocatedAmountMinor: number;
  paidIntentIds: string[];
  unresolvedIntentIds: string[];
  terminalUnpaidIntentIds: string[];
  refundLifecycleIntentIds: string[];
  actualOverpaymentMinor: number;
  potentialOverexposureMinor: number;
  requiresOperatorReview: boolean;
};

export type PaymentCoverageProjection = {
  state: Extract<
    CommerceTransactionState,
    'ready_for_payment' | 'payment_pending' | 'partially_paid' | 'payment_confirmed'
  >;
  coverage: PaymentCoverage;
};

function safeAdd(current: number, next: number, field: string): number {
  const total = current + next;
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error(`${field} exceeds Palta safe-integer range.`);
  }
  return total;
}

function assertIntentBelongsToTransaction(
  transaction: CommerceTransaction,
  intent: PaymentIntent,
): void {
  if (intent.commerceTransactionId !== transaction.id) {
    throw new Error(`PaymentIntent ${intent.id} belongs to another CommerceTransaction.`);
  }
  if (intent.merchantId !== transaction.businessId) {
    throw new Error(`PaymentIntent ${intent.id} belongs to another business.`);
  }
  if (intent.amount.currency !== transaction.currency) {
    throw new Error(`PaymentIntent ${intent.id} currency does not match CommerceTransaction.`);
  }
  assertMinorAmount(intent.amount.amountMinor, `PaymentIntent ${intent.id} amount`);
  if (intent.amount.amountMinor === 0) {
    throw new Error(`PaymentIntent ${intent.id} amount must be greater than zero.`);
  }
}

/**
 * Aggregates all payment attempts for one CommerceTransaction.
 *
 * Unresolved intents reserve their full amount. This is deliberate: a provider
 * timeout or concurrent QR payer may still capture funds, so Palta must not reuse
 * that amount for another payment until reconciliation frees it.
 */
export function calculatePaymentCoverage(input: {
  transaction: CommerceTransaction;
  intents: readonly PaymentIntent[];
}): PaymentCoverage {
  const { transaction } = input;
  assertMinorAmount(transaction.totalAmountMinor, 'CommerceTransaction totalAmountMinor');

  let paidAmountMinor = 0;
  let unresolvedAmountMinor = 0;
  const paidIntentIds: string[] = [];
  const unresolvedIntentIds: string[] = [];
  const terminalUnpaidIntentIds: string[] = [];
  const refundLifecycleIntentIds: string[] = [];
  const seenIds = new Set<string>();

  for (const intent of input.intents) {
    if (seenIds.has(intent.id)) {
      throw new Error(`Duplicate PaymentIntent ID in coverage input: ${intent.id}`);
    }
    seenIds.add(intent.id);
    assertIntentBelongsToTransaction(transaction, intent);

    if (intent.status === 'paid') {
      paidAmountMinor = safeAdd(paidAmountMinor, intent.amount.amountMinor, 'paidAmountMinor');
      paidIntentIds.push(intent.id);
      continue;
    }
    if (UNRESOLVED_PAYMENT_STATUSES.has(intent.status)) {
      unresolvedAmountMinor = safeAdd(
        unresolvedAmountMinor,
        intent.amount.amountMinor,
        'unresolvedAmountMinor',
      );
      unresolvedIntentIds.push(intent.id);
      continue;
    }
    if (TERMINAL_UNPAID_STATUSES.has(intent.status)) {
      terminalUnpaidIntentIds.push(intent.id);
      continue;
    }
    if (REFUND_LIFECYCLE_STATUSES.has(intent.status)) {
      refundLifecycleIntentIds.push(intent.id);
      continue;
    }
    const exhaustive: never = intent.status;
    throw new Error(`Unsupported PaymentIntent status: ${String(exhaustive)}`);
  }

  const potentialExposureMinor = safeAdd(
    paidAmountMinor,
    unresolvedAmountMinor,
    'potentialExposureMinor',
  );
  const remainingAfterPaidMinor = Math.max(transaction.totalAmountMinor - paidAmountMinor, 0);
  const unallocatedAmountMinor = Math.max(transaction.totalAmountMinor - potentialExposureMinor, 0);
  const actualOverpaymentMinor = Math.max(paidAmountMinor - transaction.totalAmountMinor, 0);
  const potentialOverexposureMinor = Math.max(
    potentialExposureMinor - transaction.totalAmountMinor,
    0,
  );

  return {
    transactionId: transaction.id,
    totalAmountMinor: transaction.totalAmountMinor,
    paidAmountMinor,
    unresolvedAmountMinor,
    potentialExposureMinor,
    remainingAfterPaidMinor,
    unallocatedAmountMinor,
    paidIntentIds,
    unresolvedIntentIds,
    terminalUnpaidIntentIds,
    refundLifecycleIntentIds,
    actualOverpaymentMinor,
    potentialOverexposureMinor,
    requiresOperatorReview:
      actualOverpaymentMinor > 0 ||
      potentialOverexposureMinor > 0 ||
      refundLifecycleIntentIds.length > 0,
  };
}

/**
 * Returns the pre-refund Commerce state implied by authoritative payment coverage.
 * Unsafe overpayment/overexposure/refund-lifecycle evidence is never projected
 * into a normal state; it requires reconciliation/operator review first.
 */
export function projectCommercePaymentState(input: {
  transaction: CommerceTransaction;
  intents: readonly PaymentIntent[];
}): PaymentCoverageProjection {
  const coverage = calculatePaymentCoverage(input);
  if (coverage.requiresOperatorReview) {
    throw new Error('Payment coverage requires operator review before Commerce state projection.');
  }

  if (coverage.unresolvedIntentIds.length > 0) {
    return { state: 'payment_pending', coverage };
  }
  if (coverage.paidAmountMinor === coverage.totalAmountMinor) {
    return { state: 'payment_confirmed', coverage };
  }
  if (coverage.paidAmountMinor > 0) {
    return { state: 'partially_paid', coverage };
  }
  return { state: 'ready_for_payment', coverage };
}

export type SplitPaymentAttemptDecision = {
  allowed: boolean;
  reason:
    | 'within_unallocated_balance'
    | 'amount_invalid'
    | 'coverage_requires_review'
    | 'would_exceed_transaction_total';
  unallocatedAmountMinor: number;
  potentialExposureAfterMinor: number;
};

/**
 * Guard used before opening another intentional split-payment allocation.
 * Existing unresolved amounts stay reserved until they become definitively unpaid.
 */
export function canOpenSplitPaymentAttempt(input: {
  coverage: PaymentCoverage;
  proposedAmountMinor: number;
}): SplitPaymentAttemptDecision {
  if (!Number.isSafeInteger(input.proposedAmountMinor) || input.proposedAmountMinor <= 0) {
    return {
      allowed: false,
      reason: 'amount_invalid',
      unallocatedAmountMinor: input.coverage.unallocatedAmountMinor,
      potentialExposureAfterMinor: input.coverage.potentialExposureMinor,
    };
  }
  if (input.coverage.requiresOperatorReview) {
    return {
      allowed: false,
      reason: 'coverage_requires_review',
      unallocatedAmountMinor: input.coverage.unallocatedAmountMinor,
      potentialExposureAfterMinor: input.coverage.potentialExposureMinor,
    };
  }

  const potentialExposureAfterMinor = safeAdd(
    input.coverage.potentialExposureMinor,
    input.proposedAmountMinor,
    'potentialExposureAfterMinor',
  );
  if (potentialExposureAfterMinor > input.coverage.totalAmountMinor) {
    return {
      allowed: false,
      reason: 'would_exceed_transaction_total',
      unallocatedAmountMinor: input.coverage.unallocatedAmountMinor,
      potentialExposureAfterMinor,
    };
  }
  return {
    allowed: true,
    reason: 'within_unallocated_balance',
    unallocatedAmountMinor: input.coverage.unallocatedAmountMinor,
    potentialExposureAfterMinor,
  };
}
