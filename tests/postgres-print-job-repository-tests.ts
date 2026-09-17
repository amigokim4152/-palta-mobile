import {
  applyPrintDispatchResult,
  beginPrintDispatch,
  createPrintJob,
  type PrintJob,
} from '../src/printing/printCore.js';
import { PrintJobConcurrencyError } from '../src/persistence/printJobRepository.js';
import { PostgresPrintJobRepository } from '../src/persistence/postgresPrintJobRepository.js';
import type { SqlDatabase, SqlExecutor, SqlQueryResult } from '../src/persistence/sqlDatabase.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Row = Record<string, unknown>;

function dbRow(job: PrintJob): Row {
  return {
    id: job.id,
    business_id: job.businessId,
    printer_id: job.printerId,
    document_kind: job.documentKind,
    content_json: job.content,
    status: job.status,
    idempotency_key: job.idempotencyKey,
    revision: job.revision,
    retry_authorized: job.retryAuthorized,
    provider_job_id: job.providerJobId ?? null,
    error_code: job.errorCode ?? null,
    reprint_of_job_id: job.reprintOfJobId ?? null,
    created_at: job.createdAt,
    submitted_at: job.submittedAt ?? null,
    completed_at: job.completedAt ?? null,
  };
}

class ScriptDb implements SqlDatabase {
  readonly calls: Array<{ sql: string; params: readonly unknown[] }> = [];
  constructor(private responses: Array<SqlQueryResult<Row>>) {}

  async query<TRow extends Row>(sql: string, params: readonly unknown[] = []): Promise<SqlQueryResult<TRow>> {
    this.calls.push({ sql, params });
    const response = this.responses.shift();
    if (!response) throw new Error(`Unexpected SQL: ${sql}`);
    return response as unknown as SqlQueryResult<TRow>;
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return work(this);
  }
}

const created = createPrintJob({
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  printerId: '33333333-3333-4333-8333-333333333333',
  content: { kind: 'receipt', lines: [{ text: 'Venta 1000' }], cutAfterPrint: true },
  idempotencyKey: 'receipt-sale-123',
  createdAt: '2026-09-17T20:00:00.000Z',
});

const createDb = new ScriptDb([{ rows: [dbRow(created)], rowCount: 1 }]);
const createRepo = new PostgresPrintJobRepository(createDb);
const inserted = await createRepo.saveJob({ job: created, expectedRevision: null });
assert(inserted.status === 'queued' && inserted.revision === 0, 'New print job must round-trip from Postgres.');
assert(
  createDb.calls[0]?.sql.includes('on conflict (business_id, idempotency_key) do nothing'),
  'Create must enforce business-scoped print idempotency.',
);

const dispatching = beginPrintDispatch(created, '2026-09-17T20:00:01.000Z');
const updateDb = new ScriptDb([{ rows: [dbRow(dispatching)], rowCount: 1 }]);
const updated = await new PostgresPrintJobRepository(updateDb).saveJob({
  job: dispatching,
  expectedRevision: 0,
});
assert(updated.status === 'dispatching' && updated.revision === 1, 'CAS update must persist dispatch state.');
assert(
  updateDb.calls[0]?.sql.includes('and revision = $3') && updateDb.calls[0]?.params[2] === 0,
  'Print update must compare-and-swap expected revision.',
);

const failed = applyPrintDispatchResult(
  dispatching,
  { outcome: 'failed', code: 'offline_before_write', retryable: true },
  '2026-09-17T20:00:02.000Z',
);
const failedDb = new ScriptDb([{ rows: [dbRow(failed)], rowCount: 1 }]);
const persistedFailure = await new PostgresPrintJobRepository(failedDb).saveJob({
  job: failed,
  expectedRevision: 1,
});
assert(
  persistedFailure.status === 'failed' && persistedFailure.retryAuthorized,
  'Definitive no-output failure must persist retry authorization across restart.',
);

const conflictDb = new ScriptDb([{ rows: [], rowCount: 0 }]);
let conflictBlocked = false;
try {
  await new PostgresPrintJobRepository(conflictDb).saveJob({
    job: failed,
    expectedRevision: 1,
  });
} catch (error) {
  conflictBlocked = error instanceof PrintJobConcurrencyError;
}
assert(conflictBlocked, 'Lost print CAS must surface a concurrency error instead of overwriting another process.');

const idempotencyConflictDb = new ScriptDb([{ rows: [], rowCount: 0 }]);
let idempotencyBlocked = false;
try {
  await new PostgresPrintJobRepository(idempotencyConflictDb).saveJob({
    job: created,
    expectedRevision: null,
  });
} catch (error) {
  idempotencyBlocked = error instanceof PrintJobConcurrencyError;
}
assert(idempotencyBlocked, 'Duplicate print idempotency key must not create another physical job.');

const findDb = new ScriptDb([{ rows: [dbRow(failed)], rowCount: 1 }]);
const found = await new PostgresPrintJobRepository(findDb).findByIdempotency({
  businessId: created.businessId,
  idempotencyKey: created.idempotencyKey,
});
assert(found?.id === created.id, 'Restart recovery must resolve the durable job by idempotency key.');
assert(
  findDb.calls[0]?.sql.includes('business_id = $1 and idempotency_key = $2'),
  'Print recovery lookup must remain business scoped.',
);

console.log('PASS: Postgres print job CAS repository tests');
