import { PostgresOutboxRepository } from '../src/persistence/postgresOutboxRepository.js';
import type {
  SqlDatabase,
  SqlExecutor,
  SqlQueryResult,
} from '../src/persistence/sqlDatabase.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Row = Record<string, unknown>;

type CapturedQuery = {
  sql: string;
  params: readonly unknown[];
};

class QueueDatabase implements SqlDatabase {
  readonly queries: CapturedQuery[] = [];
  private readonly results: Array<SqlQueryResult<Row>>;

  constructor(results: Array<SqlQueryResult<Row>>) {
    this.results = [...results];
  }

  async query<TRow extends Row>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<TRow>> {
    this.queries.push({ sql, params });
    const result = this.results.shift();
    if (!result) throw new Error(`No queued DB result for SQL: ${sql}`);
    return result as SqlQueryResult<TRow>;
  }

  async transaction<T>(_work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    throw new Error('Outbox claim uses one atomic UPDATE/CTE statement and does not need an outer transaction.');
  }
}

const row: Row = {
  id: '11111111-1111-4111-8111-111111111111',
  business_id: '22222222-2222-4222-8222-222222222222',
  aggregate_type: 'payment_intent',
  aggregate_id: '33333333-3333-4333-8333-333333333333',
  event_type: 'payment.reconcile',
  idempotency_key: 'outbox-payment-1',
  payload: { paymentIntentId: '33333333-3333-4333-8333-333333333333' },
  status: 'processing',
  attempts: 2,
  next_attempt_at: null,
  last_error_code: null,
  created_at: '2026-09-17T14:00:00.000Z',
  updated_at: '2026-09-17T15:00:00.000Z',
};

const claimDb = new QueueDatabase([{ rows: [row], rowCount: 1 }]);
const claimRepo = new PostgresOutboxRepository(claimDb);
const claimed = await claimRepo.claimBatch({
  workerId: 'payment-worker-1',
  now: '2026-09-17T15:00:00.000Z',
  leaseExpiresAt: '2026-09-17T15:00:30.000Z',
  limit: 25,
});
assert(claimed.length === 1 && claimed[0]?.attempts === 2, 'Claim should return canonical Outbox event.');
const claimSql = claimDb.queries[0]?.sql.toLowerCase() ?? '';
assert(
  claimSql.includes('for update skip locked') &&
    claimSql.includes("status = 'processing'") &&
    claimSql.includes('lease_expires_at <= $1::timestamptz'),
  'Outbox claim must use SKIP LOCKED and reclaim only expired processing leases.',
);
assert(
  claimDb.queries[0]?.params[1] === 'payment-worker-1' &&
    claimDb.queries[0]?.params[3] === 25,
  'Claim must persist worker identity and bounded batch size.',
);

const deliveredDb = new QueueDatabase([{ rows: [{ id: row.id }], rowCount: 1 }]);
const delivered = await new PostgresOutboxRepository(deliveredDb).markDelivered({
  eventId: row.id as string,
  workerId: 'payment-worker-1',
  occurredAt: '2026-09-17T15:00:10.000Z',
});
assert(delivered, 'Current lease owner should be able to mark work delivered.');
assert(
  deliveredDb.queries[0]?.sql.includes('claimed_by = $2'),
  'Completion must require matching worker lease ownership.',
);

const staleWorkerDb = new QueueDatabase([{ rows: [], rowCount: 0 }]);
const staleDelivered = await new PostgresOutboxRepository(staleWorkerDb).markDelivered({
  eventId: row.id as string,
  workerId: 'stale-worker',
  occurredAt: '2026-09-17T15:00:11.000Z',
});
assert(
  staleDelivered === false,
  'A stale worker whose lease was reclaimed must not overwrite the current worker outcome.',
);

const retryDb = new QueueDatabase([{ rows: [{ id: row.id }], rowCount: 1 }]);
const retryable = await new PostgresOutboxRepository(retryDb).markRetryable({
  eventId: row.id as string,
  workerId: 'payment-worker-1',
  occurredAt: '2026-09-17T15:00:12.000Z',
  nextAttemptAt: '2026-09-17T15:00:42.000Z',
  errorCode: 'provider_timeout',
});
assert(retryable, 'Retryable failure should release lease and schedule next attempt.');
assert(
  retryDb.queries[0]?.sql.includes("status = 'retryable_error'") &&
    retryDb.queries[0]?.params[3] === '2026-09-17T15:00:42.000Z',
  'Retry must persist next-attempt time instead of busy-looping.',
);

let invalidLeaseRejected = false;
try {
  await claimRepo.claimBatch({
    workerId: 'payment-worker-1',
    now: '2026-09-17T15:00:00.000Z',
    leaseExpiresAt: '2026-09-17T14:59:59.000Z',
    limit: 1,
  });
} catch {
  invalidLeaseRejected = true;
}
assert(invalidLeaseRejected, 'Outbox claim must reject non-future leases.');

console.log('PASS: leased Postgres Outbox concurrency tests');
