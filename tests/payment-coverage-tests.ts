import { createCommerceTransaction } from '../src/commerce/transaction.js';
import {
  calculatePaymentCoverage,
  canOpenSplitPaymentAttempt,
  projectCommercePaymentState,
} from '../src/payment/paymentCoverage.js';
import type { PaymentIntent } from '../src/payment/paymentModel.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const createdAt = '2026-09-17T18:00:00.000Z';
const transaction = createCommerceTransaction({
  id: 'tx-split-1',
  businessId: 'biz-1',
  idempotencyKey: 'checkout-split-1',
  lines: [
    {
      id: 'line-1',
      kind: 'product',
      title: 'Compra compartida',
      quantity: 1,
      unitAmountMinor: 10000,
      lineAmountMinor: 10000,
    },
  ],
  createdAt,
});

function intent(input: {
  id: string;
  requested: number;
  status: PaymentIntent['status'];
  processed?: number;
}): PaymentIntent {
  const value: PaymentIntent = {
    id: input.id,
    commerceTransactionId: transaction.id,
    merchantId: transaction.businessId,
    amount: { currency: 'CLP', amountMinor: input.requested },
    rail: 'card',
    status: input.status,
    revision: 0,
    settlementStatus: 'not_applicable',
    idempotencyKey: `idem-${input.id}`,
    createdAt,
    updatedAt: createdAt,
  };
  if (input.processed !== undefined) {
    value.processedAmount = { currency: 'CLP', amountMinor: input.processed };
  }
  return value;
}

const partialApproval = intent({
  id: 'pay-partial',
  requested: 10000,
  processed: 6000,
  status: 'paid',
});
const partialCoverage = calculatePaymentCoverage({
  transaction,
  intents: [partialApproval],
});
assert(
  partialCoverage.paidAmountMinor === 6000 &&
    partialCoverage.remainingAfterPaidMinor === 4000 &&
    partialCoverage.unallocatedAmountMinor === 4000,
  'A provider partial approval must count only the processed amount as authoritatively paid.',
);
assert(
  projectCommercePaymentState({ transaction, intents: [partialApproval] }).state === 'partially_paid',
  'A paid provider status with a smaller processed amount must not close the CommerceTransaction.',
);
assert(
  canOpenSplitPaymentAttempt({
    coverage: partialCoverage,
    proposedAmountMinor: 4000,
  }).allowed,
  'The exact remaining balance should be available for another split payment.',
);
assert(
  !canOpenSplitPaymentAttempt({
    coverage: partialCoverage,
    proposedAmountMinor: 4001,
  }).allowed,
  'A split payment must not exceed the remaining unallocated balance.',
);

const unresolvedRemainder = intent({
  id: 'pay-pending',
  requested: 4000,
  status: 'processing',
});
const pendingCoverage = calculatePaymentCoverage({
  transaction,
  intents: [partialApproval, unresolvedRemainder],
});
assert(
  pendingCoverage.paidAmountMinor === 6000 &&
    pendingCoverage.unresolvedAmountMinor === 4000 &&
    pendingCoverage.potentialExposureMinor === 10000 &&
    pendingCoverage.unallocatedAmountMinor === 0,
  'Unresolved split payments must reserve their full requested amount until reconciliation.',
);
assert(
  projectCommercePaymentState({
    transaction,
    intents: [partialApproval, unresolvedRemainder],
  }).state === 'payment_pending',
  'Any unresolved split payment must keep the transaction payment_pending.',
);
assert(
  !canOpenSplitPaymentAttempt({
    coverage: pendingCoverage,
    proposedAmountMinor: 1,
  }).allowed,
  'No additional payment may open while existing exposure already covers the transaction total.',
);

const overpaid = intent({
  id: 'pay-over',
  requested: 10000,
  processed: 12000,
  status: 'paid',
});
const overpaidCoverage = calculatePaymentCoverage({ transaction, intents: [overpaid] });
assert(
  overpaidCoverage.actualOverpaymentMinor === 2000 && overpaidCoverage.requiresOperatorReview,
  'Provider evidence above the requested transaction total must require operator review.',
);

let currencyMismatchBlocked = false;
try {
  calculatePaymentCoverage({
    transaction,
    intents: [{
      ...partialApproval,
      processedAmount: { currency: 'USD', amountMinor: 6000 },
    }],
  });
} catch {
  currencyMismatchBlocked = true;
}
assert(currencyMismatchBlocked, 'Processed amount currency mismatch must fail closed.');

console.log('PASS: split payment coverage and partial approval tests');
