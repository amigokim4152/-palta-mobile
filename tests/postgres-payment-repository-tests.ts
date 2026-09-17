import { createOutboxEvent } from '../src/commerce/outbox.js';
import {
  transitionPaymentIntent,
  type PaymentEvent,
  type PaymentIntent,
} from '../src/payment/paymentModel.js';
import {
  PaymentConcurrencyError,
  PaymentIdempotencyConflictError,
} from '../src/persistence/paymentRepository.js';
import { PostgresPaymentRepository } from '../src/persistence/postgresPaymentRepository.js';
import type {
  SqlDatabase,
  SqlExecutor,
  SqlQueryResult,
} from '../src/persistence/sqlDatabase.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Row = Record<string, unknown>;

type QueryResponder = (
  sql: string,
  params: readonly unknown[],
  inTransaction: boolean,
) => SqlQueryResult<Row>;

class FakeSqlDatabase implements SqlDatabase {
  transactionCount = 0;
  rootWriteAttempted = false;
  transactionQueries: string[] = [];

  constructor(private readonly responder: QueryResponder) {}

  async query<TRow extends Row>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<TRow>> {
    if (/\b(insert|update|delete)\b/i.test(sql)) this.rootWriteAttempted = true;
    return this.responder(sql, params, false) as SqlQueryResult<TRow>;
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const tx: SqlExecutor = {
      query: async <TRow extends Row>(
        sql: string,
        params: readonly unknown[] = [],
      ): Promise<SqlQueryResult<TRow>> => {
        this.transactionQueries.push(sql);
        return this.responder(sql, params, true) as SqlQueryResult<TRow>;
      },
    };
    return work(tx);
  }
}

const createdAt = '2026-09-17T14:40:00.000Z';
const businessId = '22222222-2222-4222-8222-222222222222';
const transactionId = '11111111-1111-4111-8111-111111111111';
const orderId = '44444444-4444-4444-8444-444444444444';
const providerConnectionId = '33333333-3333-4333-8333-333333333333';

const baseIntent: PaymentIntent = {
  id: '55555555-5555-4555-8555-555555555555',
  commerceTransactionId: transactionId,
  orderId,
  merchantId: businessId,
  amount: { currency: 'CLP', amountMinor: 45000 },
  rail: 'card',
  status: 'created',
  revision: 0,
  providerKey: 'mercadopago_point',
  providerConnectionId,
  terminalId: 'TERM-1',
  settlementStatus: 'not_applicable',
  idempotencyKey: 'payment-1',
  createdAt,
  updatedAt: createdAt,
};

const createdEvent: PaymentEvent = {
  id: '66666666-6666-4666-8666-666666666666',
  paymentIntentId: baseIntent.id,
  type: 'payment_created',
  occurredAt: createdAt,
  providerKey: 'mercadopago_point',
};

function paymentRow(intent: PaymentIntent = baseIntent): Row {
  return {
    id: intent.id,
    business_id: intent.merchantId,
    commerce_transaction_id: intent.commerceTransactionId,
    order_id: intent.orderId ?? null,
    idempotency_key: intent.idempotencyKey,
    amount_minor: intent.amount.amountMinor,
    processed_amount_minor: intent.processedAmount?.amountMinor ?? null,
    currency: intent.amount.currency,
    rail: intent.rail,
    status: intent.status,
    provider_key: intent.providerKey ?? null,
    provider_connection_id: intent.providerConnectionId ?? null,
    provider_reference: intent.providerReference ?? null,
    provider_payment_id: intent.providerPaymentId ?? null,
    terminal_id: intent.terminalId ?? null,
    authorization_code: intent.authorizationCode ?? null,
    card_brand: intent.cardBrand ?? null,
    card_last4: intent.cardLast4 ?? null,
    fee_minor: intent.fee?.amountMinor ?? null,
    settlement_status: intent.settlementStatus,
    settlement_reference: intent.settlementReference ?? null,
    revision: intent.revision,
    created_at: intent.createdAt,
    updated_at: intent.updatedAt,
  };
}

const createDb = new FakeSqlDatabase((sql, _params, inTransaction) => {
  assert(inTransaction, 'Payment atomic writes must use the transaction executor.');
  if (sql.includes('where business_id = $1 and idempotency_key = $2') && sql.includes('for update')) {
    return { rows: [], rowCount: 0 };
  }
  if (sql.includes('insert into payment_intent')) {
    return { rows: [paymentRow()], rowCount: 1 };
  }
  if (sql.includes('insert into payment_event')) {
    return { rows: [{ id: createdEvent.id }], rowCount: 1 };
  }
  throw new Error(`Unexpected SQL in payment create test: ${sql}`);
});

const created = await new PostgresPaymentRepository(createDb).commitIntentAndEvent({
  intent: baseIntent,
  expectedRevision: null,
  event: createdEvent,
});
assert(
  createDb.transactionCount === 1 &&
    createDb.rootWriteAttempted === false &&
    created.replayed === false &&
    created.eventInserted === true &&
    created.outboxInsertedIds.length === 0 &&
    created.intent.orderId === orderId &&
    created.intent.providerConnectionId === providerConnectionId,
  'PaymentIntent and PaymentEvent must commit in one transaction and preserve order/provider connection context.',
);

const replayDb = new FakeSqlDatabase((sql, _params, inTransaction) => {
  assert(inTransaction, 'Payment replay must use the transaction executor.');
  if (sql.includes('for update')) return { rows: [paymentRow()], rowCount: 1 };
  if (sql.includes('insert into payment_event')) return { rows: [], rowCount: 0 };
  throw new Error(`Unexpected SQL in payment replay test: ${sql}`);
});
const replayed = await new PostgresPaymentRepository(replayDb).commitIntentAndEvent({
  intent: baseIntent,
  expectedRevision: null,
  event: createdEvent,
});
assert(
  replayed.replayed === true && replayed.eventInserted === false,
  'Exact payment idempotency replay must return the original intent without duplicating the event.',
);

const conflictingRow = {
  ...paymentRow(),
  id: '77777777-7777-4777-8777-777777777777',
};
const conflictDb = new FakeSqlDatabase((sql) => {
  if (sql.includes('for update')) return { rows: [conflictingRow], rowCount: 1 };
  throw new Error(`Unexpected SQL in payment idempotency conflict test: ${sql}`);
});
let idempotencyConflict = false;
try {
  await new PostgresPaymentRepository(conflictDb).commitIntentAndEvent({
    intent: baseIntent,
    expectedRevision: null,
    event: createdEvent,
  });
} catch (error) {
  idempotencyConflict = error instanceof PaymentIdempotencyConflictError;
}
assert(
  idempotencyConflict,
  'Same business/payment idempotency key must never identify a different canonical PaymentIntent.',
);

const paidIntent: PaymentIntent = {
  ...transitionPaymentIntent(
    baseIntent,
    'paid',
    '2026-09-17T14:40:01.000Z',
  ),
  processedAmount: { currency: 'CLP', amountMinor: 30000 },
};
const paidEvent: PaymentEvent = {
  id: '88888888-8888-4888-8888-888888888888',
  paymentIntentId: paidIntent.id,
  type: 'payment_paid',
  occurredAt: paidIntent.updatedAt,
  providerKey: 'mercadopago_point',
  providerReference: 'ORD-1',
};

const updateDb = new FakeSqlDatabase((sql, _params, inTransaction) => {
  assert(inTransaction, 'Payment update/event must share one transaction executor.');
  if (sql.includes('update payment_intent')) {
    return {
      rows: [paymentRow({ ...paidIntent, providerReference: 'ORD-1' })],
      rowCount: 1,
    };
  }
  if (sql.includes('insert into payment_event')) {
    return { rows: [{ id: paidEvent.id }], rowCount: 1 };
  }
  throw new Error(`Unexpected SQL in payment update test: ${sql}`);
});
const updated = await new PostgresPaymentRepository(updateDb).commitIntentAndEvent({
  intent: { ...paidIntent, providerReference: 'ORD-1' },
  expectedRevision: 0,
  event: paidEvent,
});
assert(
  updated.intent.status === 'paid' &&
    updated.intent.revision === 1 &&
    updated.intent.processedAmount?.amountMinor === 30000 &&
    updated.intent.amount.amountMinor === 45000 &&
    updated.intent.providerConnectionId === providerConnectionId &&
    updated.eventInserted,
  'Provider-confirmed processed amount must survive the atomic DB round-trip without rewriting the requested amount.',
);

const pendingIntent = {
  ...transitionPaymentIntent(
    baseIntent,
    'pending',
    '2026-09-17T14:40:02.000Z',
  ),
  providerReference: 'ORD-PENDING',
};
const pendingEvent: PaymentEvent = {
  id: '99999999-9999-4999-8999-999999999999',
  paymentIntentId: pendingIntent.id,
  type: 'payment_pending',
  occurredAt: pendingIntent.updatedAt,
  providerKey: 'mercadopago_point',
  providerReference: 'ORD-PENDING',
};
const reconcileOutbox = createOutboxEvent({
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  businessId,
  aggregateType: 'payment_intent',
  aggregateId: pendingIntent.id,
  eventType: 'payment.reconcile',
  idempotencyKey: 'payment-1:reconcile:1',
  payload: { paymentIntentId: pendingIntent.id },
  createdAt: pendingIntent.updatedAt,
});
const reconcileDb = new FakeSqlDatabase((sql, _params, inTransaction) => {
  assert(inTransaction, 'Payment state/event/reconcile Outbox must use one transaction executor.');
  if (sql.includes('update payment_intent')) {
    return { rows: [paymentRow(pendingIntent)], rowCount: 1 };
  }
  if (sql.includes('insert into payment_event')) {
    return { rows: [{ id: pendingEvent.id }], rowCount: 1 };
  }
  if (sql.includes('insert into commerce_outbox')) {
    return { rows: [{ id: reconcileOutbox.id }], rowCount: 1 };
  }
  throw new Error(`Unexpected SQL in atomic reconcile scheduling test: ${sql}`);
});
const pendingCommitted = await new PostgresPaymentRepository(reconcileDb).commitIntentAndEvent({
  intent: pendingIntent,
  expectedRevision: 0,
  event: pendingEvent,
  outboxEvents: [reconcileOutbox],
});
assert(
  pendingCommitted.intent.status === 'pending' &&
    pendingCommitted.outboxInsertedIds[0] === reconcileOutbox.id &&
    reconcileDb.transactionCount === 1 &&
    reconcileDb.transactionQueries.some((sql) => sql.includes('update payment_intent')) &&
    reconcileDb.transactionQueries.some((sql) => sql.includes('insert into payment_event')) &&
    reconcileDb.transactionQueries.some((sql) => sql.includes('insert into commerce_outbox')),
  'Pending/unknown payment state and mandatory reconcile work must survive the same DB commit.',
);

const staleDb = new FakeSqlDatabase((sql) => {
  if (sql.includes('update payment_intent')) return { rows: [], rowCount: 0 };
  throw new Error(`Unexpected SQL in payment concurrency test: ${sql}`);
});
let concurrencyBlocked = false;
try {
  await new PostgresPaymentRepository(staleDb).commitIntentAndEvent({
    intent: paidIntent,
    expectedRevision: 0,
    event: paidEvent,
  });
} catch (error) {
  concurrencyBlocked = error instanceof PaymentConcurrencyError;
}
assert(
  concurrencyBlocked,
  'Stale webhook/polling revision must fail compare-and-swap instead of overwriting a newer payment state.',
);

console.log('PASS: atomic Postgres payment repository contract tests');
