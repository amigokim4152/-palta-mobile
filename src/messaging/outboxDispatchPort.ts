import type { OutboxEvent } from './contracts.js';

export interface ClaimedOutboxEvent extends OutboxEvent {
  processingToken: string;
  publishAttemptCount: number;
}

export interface MessageOutboxDispatchPort {
  claimBatch(input: {
    processingToken: string;
    now: string;
    staleBefore: string;
    limit: number;
  }): Promise<ClaimedOutboxEvent[]>;

  markPublished(input: {
    outboxEventId: string;
    processingToken: string;
    publishedAt: string;
  }): Promise<boolean>;

  markFailed(input: {
    outboxEventId: string;
    processingToken: string;
    error: string;
  }): Promise<boolean>;
}
