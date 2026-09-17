import type { CommerceOutboxEvent } from '../commerce/outbox.js';
import type { CommerceTransaction } from '../commerce/transaction.js';

export type CommerceTransactionLookup = {
  businessId: string;
  transactionId: string;
};

export type CommerceIdempotencyLookup = {
  businessId: string;
  idempotencyKey: string;
};

export type CommerceAtomicCommit = {
  transaction: CommerceTransaction;
  /** null creates revision 0; a number updates using compare-and-swap. */
  expectedRevision: number | null;
  outboxEvents: readonly CommerceOutboxEvent[];
};

export type CommerceAtomicCommitResult = {
  transaction: CommerceTransaction;
  insertedOutboxEventIds: readonly string[];
  replayed: boolean;
};

/**
 * Provider-neutral persistence boundary for the commerce core.
 *
 * Implementations MUST guarantee:
 * - transaction IDs are unique;
 * - (businessId, idempotencyKey) is unique;
 * - commitTransactionAndOutbox is atomic;
 * - expectedRevision is checked with compare-and-swap semantics;
 * - duplicate outbox event IDs/idempotency keys do not create duplicate side effects;
 * - exact idempotent replays return the original canonical transaction.
 */
export interface CommerceRepository {
  findTransaction(lookup: CommerceTransactionLookup): Promise<CommerceTransaction | null>;
  findTransactionByIdempotency(
    lookup: CommerceIdempotencyLookup,
  ): Promise<CommerceTransaction | null>;
  commitTransactionAndOutbox(
    commit: CommerceAtomicCommit,
  ): Promise<CommerceAtomicCommitResult>;
}

export class CommerceConcurrencyError extends Error {
  constructor(message = 'Commerce transaction revision conflict.') {
    super(message);
    this.name = 'CommerceConcurrencyError';
  }
}

export class CommerceIdempotencyConflictError extends Error {
  constructor(message = 'Commerce idempotency key already belongs to another transaction.') {
    super(message);
    this.name = 'CommerceIdempotencyConflictError';
  }
}
