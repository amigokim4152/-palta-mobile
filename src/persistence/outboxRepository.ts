import type { CommerceOutboxEvent } from '../commerce/outbox.js';

export type OutboxClaimRequest = {
  workerId: string;
  now: string;
  leaseExpiresAt: string;
  limit: number;
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
  markDelivered(request: OutboxCompleteRequest): Promise<boolean>;
  markRetryable(request: OutboxRetryRequest): Promise<boolean>;
  markDeadLetter(request: OutboxDeadLetterRequest): Promise<boolean>;
}

export function assertOutboxClaimRequest(request: OutboxClaimRequest): void {
  if (!request.workerId.trim()) throw new Error('workerId is required.');
  if (!Number.isSafeInteger(request.limit) || request.limit <= 0 || request.limit > 100) {
    throw new Error('Outbox claim limit must be an integer between 1 and 100.');
  }
  if (Date.parse(request.leaseExpiresAt) <= Date.parse(request.now)) {
    throw new Error('Outbox lease must expire after claim time.');
  }
}
