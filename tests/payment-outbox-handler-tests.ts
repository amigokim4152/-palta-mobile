import type { CommerceOutboxEvent } from '../src/commerce/outbox.js';
import { PaymentProviderOperationError } from '../src/payment/paymentIncident.js';
import {
  PaymentOutboxHandler,
  StaticPaymentPortResolver,
} from '../src/payment/paymentOutboxHandler.js';
import type { PaymentEvent, PaymentIntent } from '../src/payment/paymentModel.js';
import type {
  PaymentAtomicCommit,
  PaymentAtomicCommitResult,
  PaymentIdempotencyLookup,
  PaymentIntentLookup,
  PaymentRepository,
} from '../src/persistence/paymentRepository.js';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentPort,
  ProviderPaymentStatus,
  ReconcilePaymentInput,
  RefundInput,
} from '../src/ports/paymentPort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const BUSINESS_ID = '22222222-2222-4222-8222-222222222222';
const TRANSACTION_ID = '11111111-1111-4111-8111-111111111111';
const PAYMENT_ID = '55555555-5555-4555-8555-555555555555';
const NOW = '2026-09-17T17:10:00.000Z';

function intent(
  status: PaymentIntent['status'] = 'created',
  overrides: Partial<PaymentIntent> = {},
): PaymentIntent {
  return {
    id: PAYMENT_ID,
    commerceTransactionId: TRANSACTION_ID,
    merchantId: BUSINESS_ID,
    amount: { currency: 'CLP', amountMinor: 45000 },
    rail: 'card',
    status,
    revision: status === 'created' ? 0 : 1,
    providerKey: 'provider-test',
    terminalId: 'TERM-1',
    settlementStatus: 'not_applicable',
    idempotencyKey: 'payment-1',
    createdAt: '2026-09-17T17:00:00.000Z',
    updatedAt: status === 'created' ? '2026-09-17T17:00:00.000Z' : '2026-09-17T17:05:00.000Z',
    ...overrides,
  };
}

function outbox(attempts = 1): CommerceOutboxEvent {
  return {
    id: '77777777-7777-4777-8777-777777777777',
    businessId: BUSINESS_ID,
    aggregateType: 'payment_intent',
    aggregateId: PAYMENT_ID,
    eventType: 'payment.create',
    idempotencyKey: 'outbox-payment-1',
    payload: { paymentIntentId: PAYMENT_ID },
    status: 'processing',
    attempts,
    createdAt: '2026-09-17T17:00:00.000Z',
    updatedAt: NOW,
  };
}

class MemoryPaymentRepository implements PaymentRepository {
  current: PaymentIntent | null;
  commits: PaymentAtomicCommit[] = [];

  constructor(initial: PaymentIntent | null) {
    this.current = initial;
  }

  async findIntent(lookup: PaymentIntentLookup): Promise<PaymentIntent | null> {
    if (!this.current) return null;
    return lookup.businessId === this.current.merchantId &&
      lookup.paymentIntentId === this.current.id
      ? this.current
      : null;
  }

  async findIntentByIdempotency(
    lookup: PaymentIdempotencyLookup,
  ): Promise<PaymentIntent | null> {
    if (!this.current) return null;
    return lookup.businessId === this.current.merchantId &&
      lookup.idempotencyKey === this.current.idempotencyKey
      ? this.current
      : null;
  }

  async commitIntentAndEvent(
    commit: PaymentAtomicCommit,
  ): Promise<PaymentAtomicCommitResult> {
    if (this.current && commit.expectedRevision !== this.current.revision) {
      throw new Error('test revision conflict');
    }
    this.commits.push(commit);
    this.current = commit.intent;
    return {
      intent: commit.intent,
      eventInserted: true,
      outboxInsertedIds: [],
      replayed: false,
    };
  }
}

class StubPaymentPort implements PaymentPort {
  readonly providerKey = 'provider-test';
  createCalls = 0;
  statusCalls = 0;
  reconcileCalls = 0;
  refundCalls = 0;
  createImpl: (input: CreatePaymentInput) => Promise<CreatePaymentResult>;
  statusImpl: (reference: string) => Promise<ProviderPaymentStatus>;
  reconcileImpl?: (input: ReconcilePaymentInput) => Promise<ProviderPaymentStatus>;

  constructor(input?: {
    create?: (value: CreatePaymentInput) => Promise<CreatePaymentResult>;
    status?: (reference: string) => Promise<ProviderPaymentStatus>;
    reconcile?: (value: ReconcilePaymentInput) => Promise<ProviderPaymentStatus>;
  }) {
    this.createImpl = input?.create ?? (async () => ({
      providerKey: this.providerKey,
      providerReference: 'provider-ref-1',
      status: 'pending',
    }));
    this.statusImpl = input?.status ?? (async (reference) => ({
      providerKey: this.providerKey,
      providerReference: reference,
      status: 'paid',
    }));
    if (input?.reconcile) this.reconcileImpl = input.reconcile;
  }

  supportsRail(): boolean {
    return true;
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    this.createCalls += 1;
    return this.createImpl(input);
  }

  async getStatus(reference: string): Promise<ProviderPaymentStatus> {
    this.statusCalls += 1;
    return this.statusImpl(reference);
  }

  async reconcilePayment(input: ReconcilePaymentInput): Promise<ProviderPaymentStatus> {
    if (!this.reconcileImpl) {
      throw new Error('reconcile not configured in test stub');
    }
    this.reconcileCalls += 1;
    return this.reconcileImpl(input);
  }

  async refund(_input: RefundInput): Promise<ProviderPaymentStatus> {
    this.refundCalls += 1;
    throw new Error('refund not used in PaymentOutboxHandler tests');
  }
}

let eventSequence = 0;
function handler(repo: MemoryPaymentRepository, port: PaymentPort): PaymentOutboxHandler {
  return new PaymentOutboxHandler(
    repo,
    new StaticPaymentPortResolver([port]),
    {
      paymentEventId: () => {
        eventSequence += 1;
        return `99999999-9999-4999-8999-${String(eventSequence).padStart(12, '0')}`;
      },
    },
    () => NOW,
  );
}

// 1. New payment: create exactly once, persist pending evidence, then schedule reconciliation.
{
  const repo = new MemoryPaymentRepository(intent('created'));
  const port = new StubPaymentPort({
    create: async (input) => {
      assert(input.idempotencyKey === 'payment-1', 'Provider create must reuse canonical idempotency key.');
      return {
        providerKey: 'provider-test',
        providerReference: 'provider-ref-pending',
        providerPaymentId: 'provider-payment-1',
        status: 'pending',
      };
    },
  });
  const result = await handler(repo, port).handle(outbox(1));
  assert(port.createCalls === 1, 'Created payment must call provider create once.');
  assert(port.statusCalls === 0, 'First create must not perform a redundant status lookup.');
  assert(repo.current?.status === 'pending', 'Pending provider outcome must be stored canonically.');
  assert(repo.current?.providerReference === 'provider-ref-pending', 'Provider reference must be persisted for safe reconciliation.');
  assert(result.kind === 'retryable', 'Pending payment must remain retryable for reconciliation, not be treated as final.');
}

// 2. Existing unknown + provider reference: status lookup only; never create a replacement charge.
{
  const repo = new MemoryPaymentRepository(
    intent('unknown', { providerReference: 'provider-ref-unknown' }),
  );
  const port = new StubPaymentPort({
    status: async (reference) => ({
      providerKey: 'provider-test',
      providerReference: reference,
      providerPaymentId: 'provider-payment-2',
      authorizationCode: 'AUTH-123',
      cardBrand: 'visa',
      cardLast4: '4242',
      status: 'paid',
    }),
  });
  const result = await handler(repo, port).handle(outbox(2));
  assert(port.createCalls === 0, 'Unknown payment must never create a second charge.');
  assert(port.statusCalls === 1, 'Unknown payment with provider reference must use status lookup.');
  assert(repo.current?.status === 'paid', 'Authoritative paid reconciliation must become canonical paid.');
  assert(repo.current?.authorizationCode === 'AUTH-123', 'Safe authorization evidence must survive reconciliation.');
  assert(repo.current?.cardLast4 === '4242', 'Safe last4 evidence must survive reconciliation.');
  assert(result.kind === 'delivered', 'Paid reconciliation must finish the Outbox work.');
}

// 3. Unknown without provider reference: provider-specific safe reconciliation only, not createPayment.
{
  const repo = new MemoryPaymentRepository(intent('unknown'));
  const port = new StubPaymentPort({
    reconcile: async (input) => {
      assert(input.idempotencyKey === 'payment-1', 'Response-loss reconciliation must reuse original idempotency key.');
      return {
        providerKey: 'provider-test',
        providerReference: 'recovered-ref-1',
        status: 'paid',
      };
    },
  });
  const result = await handler(repo, port).handle(outbox(2));
  assert(port.createCalls === 0, 'Response-loss recovery must not create another payment.');
  assert(port.reconcileCalls === 1, 'Missing provider reference must use provider reconciliation capability.');
  assert(repo.current?.providerReference === 'recovered-ref-1', 'Recovered provider reference must be persisted.');
  assert(result.kind === 'delivered', 'Recovered paid payment must complete work.');
}

// 4. Operator action required: no automatic provider call and no automatic retry.
{
  const repo = new MemoryPaymentRepository(intent('requires_action'));
  const port = new StubPaymentPort();
  const result = await handler(repo, port).handle(outbox(3));
  assert(port.createCalls === 0 && port.statusCalls === 0 && port.reconcileCalls === 0, 'requires_action must stop automatic payment operations.');
  assert(result.kind === 'dead_letter' && result.errorCode === 'payment_operator_action_required', 'requires_action must surface as human/terminal intervention.');
}

// 5. Final payment: duplicate Queue delivery becomes harmless and never calls provider again.
{
  const repo = new MemoryPaymentRepository(
    intent('paid', { providerReference: 'provider-ref-paid' }),
  );
  const port = new StubPaymentPort();
  const result = await handler(repo, port).handle(outbox(4));
  assert(port.createCalls === 0 && port.statusCalls === 0 && port.reconcileCalls === 0, 'Final paid state must never hit provider again.');
  assert(repo.commits.length === 0, 'Final duplicate delivery must not create a duplicate PaymentEvent.');
  assert(result.kind === 'delivered', 'Final paid duplicate work must be acknowledged as delivered.');
}

// 6. Lost create response: persist unknown and reconcile later; never report definitive failure.
{
  const repo = new MemoryPaymentRepository(intent('created'));
  const port = new StubPaymentPort({
    create: async () => {
      throw new PaymentProviderOperationError({
        providerKey: 'provider-test',
        incidentKind: 'outcome_unknown',
        message: 'Network ended after payment request may have reached provider.',
      });
    },
  });
  const result = await handler(repo, port).handle(outbox(1));
  assert(repo.current?.status === 'unknown', 'Ambiguous create outcome must be stored as unknown.');
  assert(result.kind === 'retryable', 'Unknown outcome must be reconciled later rather than replaced.');
  const lastEvent: PaymentEvent | undefined = repo.commits.at(-1)?.event;
  assert(lastEvent?.type === 'payment_unknown', 'Unknown provider outcome must leave an auditable payment_unknown event.');
}

// 7. Terminal busy/action: canonical state must require operator action and stop automation.
{
  const repo = new MemoryPaymentRepository(intent('created'));
  const port = new StubPaymentPort({
    create: async () => {
      throw new PaymentProviderOperationError({
        providerKey: 'provider-test',
        incidentKind: 'terminal_busy',
        message: 'Terminal is busy with previous payment.',
      });
    },
  });
  const result = await handler(repo, port).handle(outbox(1));
  assert(repo.current?.status === 'requires_action', 'Terminal busy must become requires_action, not failed or paid.');
  assert(result.kind === 'dead_letter', 'Terminal intervention must stop automatic retries until a human resolves it.');
}

// 8. Definitive decline: only authoritative decline permits a new explicit payment attempt.
{
  const repo = new MemoryPaymentRepository(intent('created'));
  const port = new StubPaymentPort({
    create: async () => {
      throw new PaymentProviderOperationError({
        providerKey: 'provider-test',
        incidentKind: 'definitive_decline',
        message: 'Provider definitively declined payment.',
      });
    },
  });
  const result = await handler(repo, port).handle(outbox(1));
  assert(repo.current?.status === 'declined', 'Definitive provider decline must become canonical declined.');
  assert(result.kind === 'delivered', 'A definitive decline is a final known outcome, not retryable work.');
}

// 9. Unsupported work is isolated instead of being misrouted to a payment provider.
{
  const repo = new MemoryPaymentRepository(intent('created'));
  const port = new StubPaymentPort();
  const event = { ...outbox(1), eventType: 'fiscal.send' };
  const result = await handler(repo, port).handle(event);
  assert(result.kind === 'dead_letter' && result.errorCode === 'unsupported_payment_event_type', 'Payment worker must reject non-payment work.');
  assert(port.createCalls === 0, 'Misrouted work must never reach payment provider.');
}

console.log('PASS: resilient Payment Outbox handler tests');
