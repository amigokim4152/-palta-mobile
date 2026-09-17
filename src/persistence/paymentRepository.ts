import type { CommerceOutboxEvent } from '../commerce/outbox.js';
import type { PaymentEvent, PaymentIntent } from '../payment/paymentModel.js';

export type PaymentIntentLookup = {
  businessId: string;
  paymentIntentId: string;
};

export type PaymentIdempotencyLookup = {
  businessId: string;
  idempotencyKey: string;
};

export type CommercePaymentIntentQuery = {
  businessId: string;
  commerceTransactionId: string;
};

export type PaymentAtomicCommit = {
  intent: PaymentIntent;
  /** null creates revision 0; a number updates using compare-and-swap. */
  expectedRevision: number | null;
  event: PaymentEvent;
  /**
   * Follow-up work that must never be lost between payment state persistence and
   * asynchronous processing. Example: pending/unknown -> payment.reconcile.
   */
  outboxEvents?: readonly CommerceOutboxEvent[];
};

export type PaymentAtomicCommitResult = {
  intent: PaymentIntent;
  eventInserted: boolean;
  outboxInsertedIds: readonly string[];
  replayed: boolean;
};

export interface PaymentRepository {
  findIntent(lookup: PaymentIntentLookup): Promise<PaymentIntent | null>;
  findIntentByIdempotency(
    lookup: PaymentIdempotencyLookup,
  ): Promise<PaymentIntent | null>;
  commitIntentAndEvent(
    commit: PaymentAtomicCommit,
  ): Promise<PaymentAtomicCommitResult>;
}

/**
 * Read extension used to project split/group payment coverage onto Commerce.
 * Kept separate so focused payment writers do not gain broad transaction scans.
 */
export interface CommercePaymentQueryRepository extends PaymentRepository {
  listIntentsForTransaction(query: CommercePaymentIntentQuery): Promise<PaymentIntent[]>;
}

export class PaymentConcurrencyError extends Error {
  constructor(message = 'Payment intent revision conflict.') {
    super(message);
    this.name = 'PaymentConcurrencyError';
  }
}

export class PaymentIdempotencyConflictError extends Error {
  constructor(message = 'Payment idempotency key already belongs to another payment intent.') {
    super(message);
    this.name = 'PaymentIdempotencyConflictError';
  }
}
