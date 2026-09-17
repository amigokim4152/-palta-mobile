import type { CommerceOutboxEvent } from '../commerce/outbox.js';
import type { CommerceTransactionState } from '../commerce/transaction.js';
import type { PaymentCoverage } from '../payment/paymentCoverage.js';
import type { PaymentEvent, PaymentIntent } from '../payment/paymentModel.js';

export type CommercePaymentAllocation = {
  intent: PaymentIntent;
  event: PaymentEvent;
  providerOutboxEvent: CommerceOutboxEvent;
};

export type CommercePaymentAllocationResult = {
  intent: PaymentIntent;
  coverage: PaymentCoverage;
  commerceState: CommerceTransactionState;
  replayed: boolean;
};

export type CommercePaymentProjectionRequest = {
  businessId: string;
  commerceTransactionId: string;
  occurredAt: string;
  /**
   * Durable downstream trigger inserted only on the first transition into
   * payment_confirmed. Its idempotency key must be stable for the transaction.
   */
  confirmedOutboxEvent: CommerceOutboxEvent;
};

export type CommercePaymentProjectionResult = {
  commerceState: CommerceTransactionState;
  coverage: PaymentCoverage;
  changed: boolean;
  confirmationEventInserted: boolean;
};

/**
 * Critical split/group-payment serialization boundary.
 *
 * Implementations MUST serialize allocatePayment and projectCoverage on the same
 * canonical CommerceTransaction lock. A read-then-write service outside one DB
 * transaction is unsafe because another QR payer could allocate the same balance
 * between coverage calculation and PaymentIntent insert/Commerce confirmation.
 */
export interface CommercePaymentCoordinatorRepository {
  allocatePayment(
    allocation: CommercePaymentAllocation,
  ): Promise<CommercePaymentAllocationResult>;

  projectCoverage(
    request: CommercePaymentProjectionRequest,
  ): Promise<CommercePaymentProjectionResult>;
}

export class CommercePaymentAllocationError extends Error {
  constructor(
    public readonly code:
      | 'commerce_transaction_not_found'
      | 'commerce_state_not_payable'
      | 'payment_allocation_exceeds_balance'
      | 'payment_coverage_requires_review'
      | 'payment_idempotency_conflict',
    message: string,
  ) {
    super(message);
    this.name = 'CommercePaymentAllocationError';
  }
}
