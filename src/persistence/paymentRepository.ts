import type { PaymentEvent, PaymentIntent } from '../payment/paymentModel.js';

export type PaymentIntentLookup = {
  businessId: string;
  paymentIntentId: string;
};

export type PaymentIdempotencyLookup = {
  businessId: string;
  idempotencyKey: string;
};

export type PaymentAtomicCommit = {
  intent: PaymentIntent;
  /** null creates revision 0; a number updates using compare-and-swap. */
  expectedRevision: number | null;
  event: PaymentEvent;
};

export type PaymentAtomicCommitResult = {
  intent: PaymentIntent;
  eventInserted: boolean;
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
