import { BusinessScopedSqlDatabase } from '../src/persistence/businessScopedSqlDatabase.js';
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
  transactionNumber: number;
};

class CapturingDatabase implements SqlDatabase {
  readonly queries: CapturedQuery[] = [];
  transactionCount = 0;

  async query<TRow extends Row>(
    _sql: string,
    _params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<TRow>> {
    throw new Error('Business-scoped wrapper must not use root query directly.');
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const transactionNumber = this.transactionCount;
    const tx: SqlExecutor = {
      query: async <TRow extends Row>(
        sql: string,
        params: readonly unknown[] = [],
      ): Promise<SqlQueryResult<TRow>> => {
        this.queries.push({ sql, params, transactionNumber });
        if (sql.includes('select 42 as value')) {
          return { rows: [{ value: 42 }] as unknown as readonly TRow[], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    return work(tx);
  }
}

const delegate = new CapturingDatabase();
const scoped = new BusinessScopedSqlDatabase(
  delegate,
  '22222222-2222-4222-8222-222222222222',
);

const result = await scoped.query<{ value: number }>('select 42 as value');
assert(result.rows[0]?.value === 42, 'Scoped query should return delegate query result.');
assert(delegate.transactionCount === 1, 'A scoped read must use one database transaction.');
assert(
  delegate.queries[0]?.sql.includes('set_config') &&
    delegate.queries[0]?.params[0] === 'app.current_business_id' &&
    delegate.queries[0]?.params[1] === '22222222-2222-4222-8222-222222222222',
  'Tenant context must be set before the business query.',
);
assert(
  delegate.queries[1]?.sql.includes('select 42 as value') &&
    delegate.queries[0]?.transactionNumber === delegate.queries[1]?.transactionNumber,
  'Tenant context and business query must run on the same transaction/connection.',
);

await scoped.transaction(async (tx) => {
  await tx.query('select 42 as value');
  await tx.query('select 42 as value');
});
const secondTransactionQueries = delegate.queries.filter((query) => query.transactionNumber === 2);
assert(
  secondTransactionQueries[0]?.sql.includes('set_config') && secondTransactionQueries.length === 3,
  'Explicit scoped transaction should set tenant context exactly once before all work.',
);

let emptyBusinessRejected = false;
try {
  new BusinessScopedSqlDatabase(delegate, '   ');
} catch {
  emptyBusinessRejected = true;
}
assert(emptyBusinessRejected, 'Empty tenant/business scope must be rejected.');

console.log('PASS: business-scoped SQL tenant context tests');
