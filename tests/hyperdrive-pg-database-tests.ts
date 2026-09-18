import {
  createHyperdrivePgDatabase,
  type PgClientConstructorLike,
} from '../src/adapters/database/hyperdrivePgDatabase.js';
import type { PgClientLike } from '../src/adapters/database/pgSqlDatabase.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Row = Record<string, unknown>;

const constructedWith: string[] = [];
const clients: FakeClient[] = [];

class FakeClient implements PgClientLike {
  readonly statements: string[] = [];
  ended = false;

  constructor(config: { connectionString: string }) {
    constructedWith.push(config.connectionString);
    clients.push(this);
  }

  async connect(): Promise<void> {}

  async end(): Promise<void> {
    this.ended = true;
  }

  async query<TRow extends Row>(
    sql: string,
    _params: readonly unknown[] = [],
  ): Promise<{ rows: TRow[]; rowCount: number | null }> {
    this.statements.push(sql.toLowerCase());
    if (sql.toLowerCase().includes('select 1')) {
      return { rows: [{ ok: 1 }] as unknown as TRow[], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }
}

const db = createHyperdrivePgDatabase(
  { connectionString: 'postgres://hyperdrive/palta-dev' },
  FakeClient as PgClientConstructorLike,
);

const ready = await db.query<{ ok: number }>('select 1 as ok');
assert(ready.rows[0]?.ok === 1, 'Hyperdrive database should delegate queries.');
assert(
  constructedWith[0] === 'postgres://hyperdrive/palta-dev',
  'Hyperdrive connection string must be passed unchanged to the pg client.',
);
assert(clients[0]?.ended, 'Read client must be closed after the query.');

await db.transaction(async (tx) => {
  await tx.query('select 1 as ok');
});
const txClient = clients[1];
assert(txClient !== undefined, 'Transaction must construct a pg client.');
assert(
  txClient.statements[0] === 'begin' &&
    txClient.statements[1]?.includes('select 1') &&
    txClient.statements[2] === 'commit',
  'Hyperdrive transaction must preserve BEGIN/work/COMMIT on one client.',
);
assert(txClient.ended, 'Transaction client must be closed after commit.');

let rejectedEmpty = false;
try {
  createHyperdrivePgDatabase(
    { connectionString: '   ' },
    FakeClient as PgClientConstructorLike,
  );
} catch (error) {
  rejectedEmpty = error instanceof Error && error.message.includes('connectionString');
}
assert(rejectedEmpty, 'Empty Hyperdrive connection string must be rejected.');

console.log('PASS: Hyperdrive pg database composition tests');
