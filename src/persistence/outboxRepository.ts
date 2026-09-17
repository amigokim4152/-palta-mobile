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

export type OutboxDispatchDestination = 'payment' | 'fiscal';

export type OutboxDispatchCandidateRequest = {
  destination: OutboxDispatchDestination;
  now: string;
  limit: number;
};

export type OutboxDispatchCandidate = {
  eventId: string;
  destination: OutboxDispatchDestination;
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
  /**
   * Read-only recovery discovery for the scheduled dispatcher. It may enqueue
   * duplicates; Queue consumers still must acquire claimEvent() before side
   * effects. Event type prefixes are canonical routing keys (`payment.*`,
   * `fiscal.*`) until/if a dedicated destination column is justified later.
   */
  listDispatchCandidates(
    request: OutboxDispatchCandidateRequest,
  ): Promise<OutboxDispatchCandidate[]>;
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

function assertLimit(limit: number, field: string): void {
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 100) {
    throw new Error(`${field} must be an integer between 1 and 100.`);
  }
}

export function assertOutboxClaimRequest(request: OutboxClaimRequest): void {
  assertLease(request);
  assertLimit(request.limit, 'Outbox claim limit');
}

export function assertOutboxEventClaimRequest(request: OutboxEventClaimRequest): void {
  assertLease(request);
  if (!request.eventId.trim()) throw new Error('eventId is required.');
}

export function assertOutboxDispatchCandidateRequest(
  request: OutboxDispatchCandidateRequest,
): void {
  assertLimit(request.limit, 'Outbox dispatch limit');
  if (request.destination !== 'payment' && request.destination !== 'fiscal') {
    throw new Error('Unsupported Outbox dispatch destination.');
  }
  if (Number.isNaN(Date.parse(request.now))) throw new Error('Outbox dispatch now must be an ISO timestamp.');
}
