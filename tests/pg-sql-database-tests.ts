import {
  PgSqlDatabase,
  type PgClientLike,
} from '../src/adapters/database/pgSqlDatabase.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Row = Record<string, unknown>;

class FakePgClient implements PgClientLike {
  readonly statements: string[] = [];
  connected = false;
  ended = false;
  failOn?: string;

  async connect(): Promise<void> {
    this.connected = true;
  }

  async end(): Promise<void> {
    this.ended = true;
  }

  async query<TRow extends Row>(
    sql: string,
    _params: readonly unknown[] = [],
  ): Promise<{ rows: TRow[]; rowCount: number | null }> {
    this.statements.push(sql.toLowerCase());
    if (this.failOn && sql.toLowerCase().includes(this.failOn)) {
      throw new Error(`simulated failure: ${this.failOn}`);
    }
    if (sql.toLowerCase().includes('select 42')) {
      return { rows: [{ value: 42 }] as unknown as TRow[], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
}

const successClient = new FakePgClient();
const successDb = new PgSqlDatabase(() => successClient);
const value = await successDb.transaction(async (tx) => {
  const result = await tx.query<{ value: number }>('select 42 as value');
  return result.rows[0]?.value;
});
assert(value === 42, 'Transaction should return callback result.');
assert(
  successClient.statements[0] === 'begin' &&
    successClient.statements[1]?.includes('select 42') &&
    successClient.statements[2] === 'commit',
  'Successful transaction must BEGIN, execute work, then COMMIT in order.',
);
assert(successClient.ended, 'Successful transaction must release client.');

const failureClient = new FakePgClient();
const failureDb = new PgSqlDatabase(() => failureClient);
let failed = false;
try {
  await failureDb.transaction(async (tx) => {
    await tx.query('select 42 as value');
    throw new Error('application failure');
  });
} catch (error) {
  failed = error instanceof Error && error.message === 'application failure';
}
assert(failed, 'Original transaction error must be preserved.');
assert(
  failureClient.statements[0] === 'begin' &&
    failureClient.statements.at(-1) === 'rollback',
  'Failed transaction must ROLLBACK.',
);
assert(failureClient.ended, 'Failed transaction must release client.');

const readClient = new FakePgClient();
const readDb = new PgSqlDatabase(() => readClient);
const read = await readDb.query<{ value: number }>('select 42 as value');
assert(read.rows[0]?.value === 42, 'Root query should normalize pg result.');
assert(
  readClient.statements.length === 1 && readClient.statements[0]?.includes('select 42'),
  'Root query must not fabricate an unnecessary SQL transaction.',
);
assert(readClient.ended, 'Root query must release client.');

console.log('PASS: pg-compatible SQL database transaction adapter tests');
