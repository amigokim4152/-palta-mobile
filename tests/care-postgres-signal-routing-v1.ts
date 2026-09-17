import type { DatabasePort, QueryResult } from '../src/ports/databasePort.js';
import {
  CareSignalFanoutError,
  PostgresCareSignalRouting,
} from '../src/care/postgresCareSignalRouting.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeDatabase implements DatabasePort {
  queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  rows: Record<string, unknown>[] = [];

  async query<Row = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    this.queries.push({ sql, params });
    return { rows: this.rows as Row[] };
  }

  async transaction<T>(run: (tx: DatabasePort) => Promise<T>): Promise<T> {
    return run(this);
  }
}

const db = new FakeDatabase();
const routing = new PostgresCareSignalRouting(db);
db.rows = [
  { care_track_id: '00000000-0000-4000-8000-000000000001' },
  { care_track_id: '00000000-0000-4000-8000-000000000002' },
];

const targets = await routing.findTargetsForResource({
  sourceCore: 'delivery-core',
  resourceType: 'shipment',
  resourceId: 'shipment-44',
  maxTargets: 25,
});

assert(targets.length === 2, 'PostgreSQL Care routing must return linked Care tracks.');
assert(db.queries.length === 1, 'Care reverse routing should use one indexed database query.');
const first = db.queries[0];
assert(first?.sql.includes('care_resource_link'), 'Care routing must use care_resource_link.');
assert(first?.sql.includes("c.state <> 'cancelled'"), 'Cancelled Care tracks must not receive new signals.');
assert(first?.sql.includes('limit $4'), 'Care routing must query only maxTargets + 1 rows.');
assert(first?.params[0] === 'delivery-core', 'Source core must participate in reverse lookup identity.');
assert(first?.params[1] === 'shipment' && first?.params[2] === 'shipment-44', 'Resource identity must be exact.');
assert(first?.params[3] === 26, 'Overflow detection must query maxTargets + 1 rows.');

const overflowDb = new FakeDatabase();
overflowDb.rows = Array.from({ length: 4 }, (_, index) => ({
  care_track_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
}));
const overflowRouting = new PostgresCareSignalRouting(overflowDb);
let overflowRejected = false;
try {
  await overflowRouting.findTargetsForResource({
    sourceCore: 'delivery-core',
    resourceType: 'shipment',
    resourceId: 'shipment-broadcast',
    maxTargets: 3,
  });
} catch (error) {
  overflowRejected = error instanceof CareSignalFanoutError && error.maxTargets === 3;
}
assert(overflowRejected, 'Relationship Care routing must reject broadcast-like fan-out.');

const clampedDb = new FakeDatabase();
clampedDb.rows = [];
const clampedRouting = new PostgresCareSignalRouting(clampedDb);
await clampedRouting.findTargetsForResource({
  sourceCore: 'commerce-core',
  resourceType: 'order',
  resourceId: 'order-1',
  maxTargets: 9999,
});
assert(clampedDb.queries[0]?.params[3] === 101, 'Care routing hard limit must remain 100 targets in v1.');

console.log('PostgreSQL Care signal routing tests passed.');
