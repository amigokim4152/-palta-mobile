import { PostgresBusinessOperationalGrantRepository } from '../src/persistence/postgresBusinessOperationalGrantRepository.js';
import type {
  SqlDatabase,
  SqlExecutor,
  SqlQueryResult,
} from '../src/persistence/sqlDatabase.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type Row = Record<string, unknown>;

type SeenQuery = {
  sql: string;
  params: readonly unknown[];
};

class FakeDatabase implements SqlDatabase {
  readonly seen: SeenQuery[] = [];
  rows: Row[] = [];

  async query<TRow extends Row>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<TRow>> {
    this.seen.push({ sql, params });
    return {
      rows: this.rows as TRow[],
      rowCount: this.rows.length,
    };
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return work(this);
  }
}

const db = new FakeDatabase();
db.rows = [{
  business_id: 'biz-1',
  user_id: 'user-1',
  role: 'cashier',
  status: 'active',
  granted_by_user_id: 'owner-1',
  granted_at: '2026-09-18T00:00:00.000Z',
  expires_at: '2026-12-31T23:59:59.000Z',
}];

const repository = new PostgresBusinessOperationalGrantRepository(db);
const grant = await repository.findGrant({ businessId: 'biz-1', userId: 'user-1' });
assert(grant !== null, 'Expected business operational grant.');
assert(grant.role === 'cashier', 'Expected canonical cashier role.');
assert(grant.status === 'active', 'Expected active status.');
assert(grant.expiresAt === '2026-12-31T23:59:59.000Z', 'Expected expiration mapping.');
assert(
  db.seen[0]?.params[0] === 'biz-1' && db.seen[0]?.params[1] === 'user-1',
  'Grant lookup must bind both business and verified user IDs.',
);

const missingDb = new FakeDatabase();
const missing = await new PostgresBusinessOperationalGrantRepository(missingDb).findGrant({
  businessId: 'biz-1',
  userId: 'user-missing',
});
assert(missing === null, 'Missing grant should return null.');

const corruptDb = new FakeDatabase();
corruptDb.rows = [{
  business_id: 'biz-1',
  user_id: 'user-1',
  role: 'superadmin',
  status: 'active',
  granted_by_user_id: 'owner-1',
  granted_at: '2026-09-18T00:00:00.000Z',
  expires_at: null,
}];
let corruptRejected = false;
try {
  await new PostgresBusinessOperationalGrantRepository(corruptDb).findGrant({
    businessId: 'biz-1',
    userId: 'user-1',
  });
} catch (error) {
  corruptRejected = error instanceof Error && error.message.includes('role');
}
assert(corruptRejected, 'Unknown database role must fail closed.');

console.log('PASS: PostgreSQL business operational grant repository tests');
