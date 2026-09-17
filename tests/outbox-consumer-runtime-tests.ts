import type { CommerceOutboxEvent } from '../src/commerce/outbox.js';
import type {
  OutboxClaimRequest,
  OutboxCompleteRequest,
  OutboxDeadLetterRequest,
  OutboxDispatchCandidateRequest,
  OutboxEventClaimRequest,
  OutboxRepository,
  OutboxRetryRequest,
} from '../src/persistence/outboxRepository.js';
import {
  consumeOutboxQueueMessage,
  OutboxLeaseLostError,
  type OutboxEventHandler,
} from '../src/runtime/outboxConsumer.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const event: CommerceOutboxEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  aggregateType: 'payment_intent',
  aggregateId: '33333333-3333-4333-8333-333333333333',
  eventType: 'payment.reconcile',
  idempotencyKey: 'outbox-payment-1',
  payload: { paymentIntentId: '33333333-3333-4333-8333-333333333333' },
  status: 'processing',
  attempts: 1,
  createdAt: '2026-09-17T15:00:00.000Z',
  updatedAt: '2026-09-17T15:01:00.000Z',
};

class ConsumerRepository implements OutboxRepository {
  claimResult: CommerceOutboxEvent | null = event;
  delivered = true;
  retryable = true;
  deadLetter = true;
  claimCalls: OutboxEventClaimRequest[] = [];
  deliveredCalls: OutboxCompleteRequest[] = [];
  retryCalls: OutboxRetryRequest[] = [];
  deadLetterCalls: OutboxDeadLetterRequest[] = [];

  async claimEvent(request: OutboxEventClaimRequest) {
    this.claimCalls.push(request);
    return this.claimResult;
  }

  async markDelivered(request: OutboxCompleteRequest) {
    this.deliveredCalls.push(request);
    return this.delivered;
  }

  async markRetryable(request: OutboxRetryRequest) {
    this.retryCalls.push(request);
    return this.retryable;
  }

  async markDeadLetter(request: OutboxDeadLetterRequest) {
    this.deadLetterCalls.push(request);
    return this.deadLetter;
  }

  async claimBatch(_request: OutboxClaimRequest): Promise<CommerceOutboxEvent[]> {
    throw new Error('not used');
  }

  async listDispatchCandidates(_request: OutboxDispatchCandidateRequest) {
    throw new Error('not used');
  }
}

const deliveredRepo = new ConsumerRepository();
let deliveredHandlerCalls = 0;
const deliveredHandler: OutboxEventHandler = {
  async handle(claimed) {
    deliveredHandlerCalls += 1;
    assert(claimed.id === event.id, 'Handler must receive the DB-claimed canonical event.');
    return { kind: 'delivered' };
  },
};
const deliveredResult = await consumeOutboxQueueMessage({
  rawMessage: { outboxEventId: event.id },
  repository: deliveredRepo,
  handler: deliveredHandler,
  workerId: 'payment-worker-1',
  now: '2026-09-17T15:02:00.000Z',
  leaseExpiresAt: '2026-09-17T15:02:30.000Z',
});
assert(
  deliveredResult.status === 'delivered' &&
    deliveredHandlerCalls === 1 &&
    deliveredRepo.claimCalls.length === 1 &&
    deliveredRepo.deliveredCalls.length === 1,
  'Consumer must claim first, execute handler once, then persist delivered status.',
);

const duplicateRepo = new ConsumerRepository();
duplicateRepo.claimResult = null;
let duplicateHandlerCalled = false;
const duplicateResult = await consumeOutboxQueueMessage({
  rawMessage: { outboxEventId: event.id },
  repository: duplicateRepo,
  handler: {
    async handle() {
      duplicateHandlerCalled = true;
      return { kind: 'delivered' };
    },
  },
  workerId: 'payment-worker-2',
  now: '2026-09-17T15:02:05.000Z',
  leaseExpiresAt: '2026-09-17T15:02:35.000Z',
});
assert(
  duplicateResult.status === 'not_claimed' && duplicateHandlerCalled === false,
  'Duplicate/live-lease Queue delivery must not execute provider/SII handler.',
);

const retryRepo = new ConsumerRepository();
const retryResult = await consumeOutboxQueueMessage({
  rawMessage: { outboxEventId: event.id },
  repository: retryRepo,
  handler: {
    async handle() {
      return {
        kind: 'retryable',
        nextAttemptAt: '2026-09-17T15:03:00.000Z',
        errorCode: 'provider_temporarily_unavailable',
      };
    },
  },
  workerId: 'payment-worker-1',
  now: '2026-09-17T15:02:10.000Z',
  leaseExpiresAt: '2026-09-17T15:02:40.000Z',
});
assert(
  retryResult.status === 'retryable' &&
    retryRepo.retryCalls[0]?.nextAttemptAt === '2026-09-17T15:03:00.000Z',
  'Retryable provider result must release DB lease into scheduled retry state.',
);

const deadRepo = new ConsumerRepository();
const deadResult = await consumeOutboxQueueMessage({
  rawMessage: { outboxEventId: event.id },
  repository: deadRepo,
  handler: {
    async handle() {
      return { kind: 'dead_letter', errorCode: 'invalid_provider_configuration' };
    },
  },
  workerId: 'payment-worker-1',
  now: '2026-09-17T15:02:15.000Z',
  leaseExpiresAt: '2026-09-17T15:02:45.000Z',
});
assert(
  deadResult.status === 'dead_letter' && deadRepo.deadLetterCalls.length === 1,
  'Non-retryable operational failure must become durable DB dead-letter state.',
);

const thrownRepo = new ConsumerRepository();
let thrownPropagated = false;
try {
  await consumeOutboxQueueMessage({
    rawMessage: { outboxEventId: event.id },
    repository: thrownRepo,
    handler: {
      async handle() {
        throw new Error('unknown_after_external_call');
      },
    },
    workerId: 'payment-worker-1',
    now: '2026-09-17T15:02:20.000Z',
    leaseExpiresAt: '2026-09-17T15:02:50.000Z',
  });
} catch (error) {
  thrownPropagated = error instanceof Error && error.message === 'unknown_after_external_call';
}
assert(
  thrownPropagated &&
    thrownRepo.deliveredCalls.length === 0 &&
    thrownRepo.retryCalls.length === 0 &&
    thrownRepo.deadLetterCalls.length === 0,
  'Unknown handler exception must not guess delivered/retry outcome; lease expiry + dispatcher recovers it.',
);

const lostLeaseRepo = new ConsumerRepository();
lostLeaseRepo.delivered = false;
let leaseLossRaised = false;
try {
  await consumeOutboxQueueMessage({
    rawMessage: { outboxEventId: event.id },
    repository: lostLeaseRepo,
    handler: { async handle() { return { kind: 'delivered' }; } },
    workerId: 'stale-worker',
    now: '2026-09-17T15:02:25.000Z',
    leaseExpiresAt: '2026-09-17T15:02:55.000Z',
  });
} catch (error) {
  leaseLossRaised = error instanceof OutboxLeaseLostError;
}
assert(
  leaseLossRaised,
  'A worker that lost DB lease must not report success to Queue/runtime.',
);

console.log('PASS: canonical Outbox Queue consumer runtime tests');
