import type { CommerceOutboxEvent } from '../commerce/outbox.js';

export type OutboxClaimRequest = {
  workerId: string;
  now: string;
  leaseExpiresAt: string;
  limit: number;
};

export type OutboxEventClaimRequest = Omit<OutboxClaimRequest, 'limit'> & {
  eventId: string;
};

export type OutboxCompleteRequest = {
  eventId: string;
  workerId: string;
  occurredAt: string;
};

export type OutboxRetryRequest = OutboxCompleteRequest & {
  nextAttemptAt: string;
  errorCode: string;
};

export type OutboxDeadLetterRequest = OutboxCompleteRequest & {
  errorCode: string;
};

export interface OutboxRepository {
  claimBatch(request: OutboxClaimRequest): Promise<CommerceOutboxEvent[]>;
  /**
   * Claims exactly one event by canonical Outbox ID. Queue consumers use this
   * before doing any external side effect, so duplicate Queue deliveries become
   * harmless no-ops when another worker already owns a live lease.
   */
  claimEvent(request: OutboxEventClaimRequest): Promise<CommerceOutboxEvent | null>;
  markDelivered(request: OutboxCompleteRequest): Promise<boolean>;
  markRetryable(request: OutboxRetryRequest): Promise<boolean>;
  markDeadLetter(request: OutboxDeadLetterRequest): Promise<boolean>;
}

function assertLease(input: {
  workerId: string;
  now: string;
  leaseExpiresAt: string;
}): void {
  if (!input.workerId.trim()) throw new Error('workerId is required.');
  if (Date.parse(input.leaseExpiresAt) <= Date.parse(input.now)) {
    throw new Error('Outbox lease must expire after claim time.');
  }
}

export function assertOutboxClaimRequest(request: OutboxClaimRequest): void {
  assertLease(request);
  if (!Number.isSafeInteger(request.limit) || request.limit <= 0 || request.limit > 100) {
    throw new Error('Outbox claim limit must be an integer between 1 and 100.');
  }
}

export function assertOutboxEventClaimRequest(request: OutboxEventClaimRequest): void {
  assertLease(request);
  if (!request.eventId.trim()) throw new Error('eventId is required.');
}
