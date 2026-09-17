import {
  dispatchDueOutbox,
  parseOutboxQueueMessage,
  type OutboxQueueMessage,
  type OutboxQueuePublisher,
} from '../src/runtime/outboxQueue.js';
import type {
  OutboxClaimRequest,
  OutboxCompleteRequest,
  OutboxDeadLetterRequest,
  OutboxDispatchCandidateRequest,
  OutboxEventClaimRequest,
  OutboxRepository,
  OutboxRetryRequest,
} from '../src/persistence/outboxRepository.js';
import type { CommerceOutboxEvent } from '../src/commerce/outbox.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class DispatchOnlyRepository implements OutboxRepository {
  readonly discoveryCalls: OutboxDispatchCandidateRequest[] = [];

  async listDispatchCandidates(request: OutboxDispatchCandidateRequest) {
    this.discoveryCalls.push(request);
    if (request.destination === 'payment') {
      return [
        { eventId: 'payment-event-1', destination: 'payment' as const },
        { eventId: 'payment-event-2', destination: 'payment' as const },
      ];
    }
    return [{ eventId: 'fiscal-event-1', destination: 'fiscal' as const }];
  }

  async claimBatch(_request: OutboxClaimRequest): Promise<CommerceOutboxEvent[]> {
    throw new Error('not used');
  }

  async claimEvent(_request: OutboxEventClaimRequest): Promise<CommerceOutboxEvent | null> {
    throw new Error('not used');
  }

  async markDelivered(_request: OutboxCompleteRequest): Promise<boolean> {
    throw new Error('not used');
  }

  async markRetryable(_request: OutboxRetryRequest): Promise<boolean> {
    throw new Error('not used');
  }

  async markDeadLetter(_request: OutboxDeadLetterRequest): Promise<boolean> {
    throw new Error('not used');
  }
}

class CapturingPublisher implements OutboxQueuePublisher {
  readonly messages: OutboxQueueMessage[] = [];

  constructor(private readonly failForEventId?: string) {}

  async send(message: OutboxQueueMessage): Promise<void> {
    if (message.outboxEventId === this.failForEventId) {
      throw new Error('simulated_queue_failure');
    }
    this.messages.push(message);
  }
}

assert(
  parseOutboxQueueMessage({ outboxEventId: 'event-1' }).outboxEventId === 'event-1',
  'Queue message parser must accept canonical Outbox ID.',
);

let sensitiveQueuePayloadRejected = false;
try {
  parseOutboxQueueMessage({
    outboxEventId: 'event-1',
    customerRut: '11111111-1',
  });
} catch {
  sensitiveQueuePayloadRejected = true;
}
assert(
  sensitiveQueuePayloadRejected,
  'Queue envelope must reject extra business/customer/payment/fiscal payload fields.',
);

const repository = new DispatchOnlyRepository();
const paymentPublisher = new CapturingPublisher('payment-event-2');
const fiscalPublisher = new CapturingPublisher();
const report = await dispatchDueOutbox({
  repository,
  publishers: {
    payment: paymentPublisher,
    fiscal: fiscalPublisher,
  },
  now: '2026-09-17T15:15:00.000Z',
  limitPerDestination: 100,
});

assert(
  repository.discoveryCalls.length === 2 &&
    repository.discoveryCalls[0]?.destination === 'payment' &&
    repository.discoveryCalls[1]?.destination === 'fiscal',
  'Recovery dispatcher must independently discover payment and fiscal due work.',
);
assert(
  report.discovered === 3 && report.published === 2 && report.failed === 1,
  'Queue publication failure must be reported without stopping other destinations.',
);
assert(
  paymentPublisher.messages[0]?.outboxEventId === 'payment-event-1' &&
    fiscalPublisher.messages[0]?.outboxEventId === 'fiscal-event-1',
  'Dispatcher must publish canonical Outbox IDs only.',
);
assert(
  report.failures[0]?.eventId === 'payment-event-2',
  'Failed Queue publication remains discoverable in DB on the next scheduled sweep.',
);

console.log('PASS: DB-first Outbox Queue dispatch runtime tests');
