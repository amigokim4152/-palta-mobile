import type { CommerceOutboxEvent } from '../commerce/outbox.js';
import type { OutboxRepository } from '../persistence/outboxRepository.js';
import {
  parseOutboxQueueMessage,
  type OutboxQueueMessage,
} from './outboxQueue.js';

export type OutboxHandlerResult =
  | { kind: 'delivered' }
  | {
      kind: 'retryable';
      nextAttemptAt: string;
      errorCode: string;
    }
  | {
      kind: 'dead_letter';
      errorCode: string;
    };

export interface OutboxEventHandler {
  handle(event: CommerceOutboxEvent): Promise<OutboxHandlerResult>;
}

export type OutboxConsumerResult =
  | {
      status: 'not_claimed';
      eventId: string;
    }
  | {
      status: 'delivered';
      eventId: string;
    }
  | {
      status: 'retryable';
      eventId: string;
      nextAttemptAt: string;
      errorCode: string;
    }
  | {
      status: 'dead_letter';
      eventId: string;
      errorCode: string;
    };

export class OutboxLeaseLostError extends Error {
  constructor() {
    super('Outbox lease ownership was lost before completion state could be persisted.');
    this.name = 'OutboxLeaseLostError';
  }
}

function assertHandlerResult(result: OutboxHandlerResult): void {
  if (result.kind === 'retryable') {
    if (!result.errorCode.trim()) throw new Error('Retryable Outbox result requires errorCode.');
    if (Number.isNaN(Date.parse(result.nextAttemptAt))) {
      throw new Error('Retryable Outbox result requires a valid nextAttemptAt timestamp.');
    }
  }
  if (result.kind === 'dead_letter' && !result.errorCode.trim()) {
    throw new Error('Dead-letter Outbox result requires errorCode.');
  }
}

/**
 * Canonical Queue-consumer sequence:
 *
 * Queue envelope -> exact DB lease -> handler -> DB completion state.
 *
 * Unexpected handler exceptions intentionally leave the DB lease intact and
 * propagate to the runtime. Queue retry may arrive while the lease is still
 * live and become `not_claimed`; the scheduled DB dispatcher will rediscover
 * the work after lease expiry. This avoids guessing whether an unknown external
 * side effect is safe to repeat.
 */
export async function consumeOutboxQueueMessage(input: {
  rawMessage: unknown;
  repository: OutboxRepository;
  handler: OutboxEventHandler;
  workerId: string;
  now: string;
  leaseExpiresAt: string;
}): Promise<OutboxConsumerResult> {
  const message: OutboxQueueMessage = parseOutboxQueueMessage(input.rawMessage);
  const event = await input.repository.claimEvent({
    eventId: message.outboxEventId,
    workerId: input.workerId,
    now: input.now,
    leaseExpiresAt: input.leaseExpiresAt,
  });

  if (!event) {
    return {
      status: 'not_claimed',
      eventId: message.outboxEventId,
    };
  }

  const result = await input.handler.handle(event);
  assertHandlerResult(result);

  if (result.kind === 'delivered') {
    const persisted = await input.repository.markDelivered({
      eventId: event.id,
      workerId: input.workerId,
      occurredAt: input.now,
    });
    if (!persisted) throw new OutboxLeaseLostError();
    return { status: 'delivered', eventId: event.id };
  }

  if (result.kind === 'retryable') {
    const persisted = await input.repository.markRetryable({
      eventId: event.id,
      workerId: input.workerId,
      occurredAt: input.now,
      nextAttemptAt: result.nextAttemptAt,
      errorCode: result.errorCode,
    });
    if (!persisted) throw new OutboxLeaseLostError();
    return {
      status: 'retryable',
      eventId: event.id,
      nextAttemptAt: result.nextAttemptAt,
      errorCode: result.errorCode,
    };
  }

  const persisted = await input.repository.markDeadLetter({
    eventId: event.id,
    workerId: input.workerId,
    occurredAt: input.now,
    errorCode: result.errorCode,
  });
  if (!persisted) throw new OutboxLeaseLostError();
  return {
    status: 'dead_letter',
    eventId: event.id,
    errorCode: result.errorCode,
  };
}
