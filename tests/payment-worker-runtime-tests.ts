import type { CommerceOutboxEvent } from '../src/commerce/outbox.js';
import type { PaymentIntent } from '../src/payment/paymentModel.js';
import type {
  PaymentAtomicCommit,
  PaymentAtomicCommitResult,
  PaymentIdempotencyLookup,
  PaymentIntentLookup,
  PaymentRepository,
} from '../src/persistence/paymentRepository.js';
import type {
  OutboxClaimRequest,
  OutboxCompleteRequest,
  OutboxDeadLetterRequest,
  OutboxDispatchCandidate,
  OutboxDispatchCandidateRequest,
  OutboxEventClaimRequest,
  OutboxRepository,
  OutboxRetryRequest,
} from '../src/persistence/outboxRepository.js';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentPort,
  ProviderPaymentStatus,
  RefundInput,
} from '../src/ports/paymentPort.js';
import { processPaymentQueueMessage } from '../src/runtime/paymentWorker.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const intent: PaymentIntent = {
  id: '55555555-5555-4555-8555-555555555555',
  commerceTransactionId: '11111111-1111-4111-8111-111111111111',
  merchantId: '22222222-2222-4222-8222-222222222222',
  amount: { currency: 'CLP', amountMinor: 15000 },
  rail: 'card',
  status: 'created',
  revision: 0,
  providerKey: 'provider-runtime-test',
  settlementStatus: 'not_applicable',
  idempotencyKey: 'runtime-payment-1',
  createdAt: '2026-09-17T17:20:00.000Z',
  updatedAt: '2026-09-17T17:20:00.000Z',
};

const event: CommerceOutboxEvent = {
  id: '77777777-7777-4777-8777-777777777777',
  businessId: intent.merchantId,
  aggregateType: 'payment_intent',
  aggregateId: intent.id,
  eventType: 'payment.create',
  idempotencyKey: 'runtime-outbox-1',
  payload: { paymentIntentId: intent.id },
  status: 'processing',
  attempts: 1,
  createdAt: intent.createdAt,
  updatedAt: intent.updatedAt,
};

class RuntimeOutboxRepository implements OutboxRepository {
  claimRequest?: OutboxEventClaimRequest;
  deliveredRequest?: OutboxCompleteRequest;
  claimValue: CommerceOutboxEvent | null = event;

  async claimEvent(request: OutboxEventClaimRequest) {
    this.claimRequest = request;
    return this.claimValue;
  }
  async markDelivered(request: OutboxCompleteRequest) {
    this.deliveredRequest = request;
    return true;
  }
  async markRetryable(_request: OutboxRetryRequest) { return true; }
  async markDeadLetter(_request: OutboxDeadLetterRequest) { return true; }
  async claimBatch(_request: OutboxClaimRequest): Promise<CommerceOutboxEvent[]> { return []; }
  async listDispatchCandidates(_request: OutboxDispatchCandidateRequest): Promise<OutboxDispatchCandidate[]> { return []; }
}

class RuntimePaymentRepository implements PaymentRepository {
  current: PaymentIntent = intent;
  commits: PaymentAtomicCommit[] = [];
  async findIntent(lookup: PaymentIntentLookup) {
    return lookup.paymentIntentId === this.current.id && lookup.businessId === this.current.merchantId
      ? this.current
      : null;
  }
  async findIntentByIdempotency(_lookup: PaymentIdempotencyLookup) { return this.current; }
  async commitIntentAndEvent(commit: PaymentAtomicCommit): Promise<PaymentAtomicCommitResult> {
    this.commits.push(commit);
    this.current = commit.intent;
    return { intent: commit.intent, eventInserted: true, outboxInsertedIds: [], replayed: false };
  }
}

class RuntimePaymentPort implements PaymentPort {
  readonly providerKey = 'provider-runtime-test';
  createCalls = 0;
  supportsRail() { return true; }
  async createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.createCalls += 1;
    return {
      providerKey: this.providerKey,
      providerReference: 'runtime-ref-1',
      status: 'paid',
    };
  }
  async getStatus(reference: string): Promise<ProviderPaymentStatus> {
    return { providerKey: this.providerKey, providerReference: reference, status: 'paid' };
  }
  async refund(_input: RefundInput): Promise<ProviderPaymentStatus> {
    throw new Error('not used');
  }
}

const outbox = new RuntimeOutboxRepository();
const payments = new RuntimePaymentRepository();
const port = new RuntimePaymentPort();
let id = 0;
const result = await processPaymentQueueMessage({
  rawMessage: { outboxEventId: event.id },
  outboxRepository: outbox,
  paymentRepository: payments,
  paymentPorts: [port],
  ids: { paymentEventId: () => `99999999-9999-4999-8999-${String(++id).padStart(12, '0')}` },
  workerId: 'payment-worker-test-1',
  now: () => '2026-09-17T17:21:00.000Z',
  leaseSeconds: 30,
});

assert(result.status === 'delivered', 'Payment Worker should complete a final paid provider outcome.');
assert(port.createCalls === 1, 'Payment Worker should invoke provider create exactly once for a created intent.');
assert(payments.current.status === 'paid', 'Payment Worker must persist canonical paid state before delivery.');
assert(outbox.claimRequest?.leaseExpiresAt === '2026-09-17T17:21:30.000Z', 'Payment Worker must calculate bounded DB lease expiry.');
assert(outbox.deliveredRequest?.workerId === 'payment-worker-test-1', 'Completion must be persisted by the same lease owner.');

const duplicateOutbox = new RuntimeOutboxRepository();
duplicateOutbox.claimValue = null;
const duplicatePort = new RuntimePaymentPort();
const duplicateResult = await processPaymentQueueMessage({
  rawMessage: { outboxEventId: event.id },
  outboxRepository: duplicateOutbox,
  paymentRepository: new RuntimePaymentRepository(),
  paymentPorts: [duplicatePort],
  ids: { paymentEventId: () => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  workerId: 'payment-worker-test-2',
  now: () => '2026-09-17T17:21:05.000Z',
});
assert(duplicateResult.status === 'not_claimed', 'Duplicate Queue delivery must stop when DB lease cannot be acquired.');
assert(duplicatePort.createCalls === 0, 'Duplicate Queue delivery must never reach payment provider.');

let invalidLeaseRejected = false;
try {
  await processPaymentQueueMessage({
    rawMessage: { outboxEventId: event.id },
    outboxRepository: new RuntimeOutboxRepository(),
    paymentRepository: new RuntimePaymentRepository(),
    paymentPorts: [new RuntimePaymentPort()],
    ids: { paymentEventId: () => 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    workerId: 'payment-worker-test-3',
    now: () => '2026-09-17T17:21:10.000Z',
    leaseSeconds: 1,
  });
} catch {
  invalidLeaseRejected = true;
}
assert(invalidLeaseRejected, 'Payment Worker must reject unsafe lease durations.');

console.log('PASS: provider-neutral Payment Worker runtime tests');
