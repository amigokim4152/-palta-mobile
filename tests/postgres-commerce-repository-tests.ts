import { createOutboxEvent } from '../src/commerce/outbox.js';
import {
  createCommerceTransaction,
  transitionCommerceTransaction,
} from '../src/commerce/transaction.js';
import {
  CommerceConcurrencyError,
  CommerceIdempotencyConflictError,
} from '../src/persistence/commerceRepository.js';
import { PostgresCommerceRepository } from '../src/persistence/postgresCommerceRepository.js';
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

const createdAt = '2026-09-17T12:00:00.000Z';
const baseTransaction = createCommerceTransaction({
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  idempotencyKey: 'sale-1',
  lines: [
    {
      id: 'line-1',
      kind: 'service',
      title: 'Jardinería',
      quantity: 1,
      unitAmountMinor: 45000,
      lineAmountMinor: 45000,
    },
  ],
  createdAt,
});

function transactionRow(transaction = baseTransaction): Row {
  return {
    id: transaction.id,
    business_id: transaction.businessId,
    idempotency_key: transaction.idempotencyKey,
    state: transaction.state,
    currency: transaction.currency,
    total_amount_minor: transaction.totalAmountMinor,
    lines: transaction.lines,
    revision: transaction.revision,
    outlet_id: transaction.outletId ?? null,
    trading_session_id: transaction.tradingSessionId ?? null,
    operator_id: transaction.operatorId ?? null,
    customer_id: transaction.customerId ?? null,
    created_at: transaction.createdAt,
    updated_at: transaction.updatedAt,
  };
}

const outbox = createOutboxEvent({
  id: '33333333-3333-4333-8333-333333333333',
  businessId: baseTransaction.businessId,
  aggregateType: 'commerce_transaction',
  aggregateId: baseTransaction.id,
  eventType: 'commerce.created',
  idempotencyKey: 'outbox-sale-1',
  payload: { transactionId: baseTransaction.id },
  createdAt,
});

const createDb = new FakeSqlDatabase((sql, _params, inTransaction) => {
  assert(inTransaction, 'Commerce atomic writes must use the transaction executor.');
  if (sql.includes('where business_id = $1 and idempotency_key = $2') && sql.includes('for update')) {
    return { rows: [], rowCount: 0 };
  }
  if (sql.includes('insert into commerce_transaction')) {
    return { rows: [transactionRow()], rowCount: 1 };
  }
  if (sql.includes('insert into commerce_outbox')) {
    return { rows: [{ id: outbox.id }], rowCount: 1 };
  }
  throw new Error(`Unexpected SQL in create test: ${sql}`);
});
const createRepository = new PostgresCommerceRepository(createDb);
const created = await createRepository.commitTransactionAndOutbox({
  transaction: baseTransaction,
  expectedRevision: null,
  outboxEvents: [outbox],
});
assert(
  createDb.transactionCount === 1 &&
    createDb.rootWriteAttempted === false &&
    created.replayed === false &&
    created.insertedOutboxEventIds[0] === outbox.id,
  'Commerce create and Outbox insert must execute inside one SQL transaction.',
);

const replayDb = new FakeSqlDatabase((sql, _params, inTransaction) => {
  assert(inTransaction, 'Replay must use the same SQL transaction boundary.');
  if (sql.includes('for update')) {
    return { rows: [transactionRow()], rowCount: 1 };
  }
  if (sql.includes('insert into commerce_outbox')) {
    return { rows: [], rowCount: 0 };
  }
  throw new Error(`Unexpected SQL in replay test: ${sql}`);
});
const replayed = await new PostgresCommerceRepository(replayDb).commitTransactionAndOutbox({
  transaction: baseTransaction,
  expectedRevision: null,
  outboxEvents: [outbox],
});
assert(
  replayed.replayed === true && replayed.insertedOutboxEventIds.length === 0,
  'Exact business/idempotency replay must return the original transaction without duplicating Outbox work.',
);

const conflictingRow = {
  ...transactionRow(),
  id: '44444444-4444-4444-8444-444444444444',
};
const conflictDb = new FakeSqlDatabase((sql) => {
  if (sql.includes('for update')) return { rows: [conflictingRow], rowCount: 1 };
  throw new Error(`Unexpected SQL in idempotency conflict test: ${sql}`);
});
let idempotencyConflict = false;
try {
  await new PostgresCommerceRepository(conflictDb).commitTransactionAndOutbox({
    transaction: baseTransaction,
    expectedRevision: null,
    outboxEvents: [outbox],
  });
} catch (error) {
  idempotencyConflict = error instanceof CommerceIdempotencyConflictError;
}
assert(
  idempotencyConflict,
  'Same business/idempotency key must not be allowed to identify a different canonical transaction.',
);

const nextTransaction = transitionCommerceTransaction(
  baseTransaction,
  'ready_for_payment',
  '2026-09-17T12:00:01.000Z',
);
const staleDb = new FakeSqlDatabase((sql) => {
  if (sql.includes('update commerce_transaction')) return { rows: [], rowCount: 0 };
  throw new Error(`Unexpected SQL in concurrency test: ${sql}`);
});
let concurrencyBlocked = false;
try {
  await new PostgresCommerceRepository(staleDb).commitTransactionAndOutbox({
    transaction: nextTransaction,
    expectedRevision: 0,
    outboxEvents: [],
  });
} catch (error) {
  concurrencyBlocked = error instanceof CommerceConcurrencyError;
}
assert(
  concurrencyBlocked,
  'Stale commerce revision must fail compare-and-swap instead of silently overwriting another cashier/device update.',
);

console.log('PASS: atomic Postgres commerce repository contract tests');
