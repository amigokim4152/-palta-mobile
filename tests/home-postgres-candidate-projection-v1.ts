import type { DatabasePort, QueryResult } from '../src/ports/databasePort.js';
import { PostgresHomeCandidateProjection } from '../src/home/postgresHomeCandidateProjection.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeDatabase implements DatabasePort {
  queries: Array<{ sql: string; params: readonly unknown[] }> = [];

  async query<Row = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    this.queries.push({ sql, params });
    return { rows: [] as Row[] };
  }

  async transaction<T>(run: (tx: DatabasePort) => Promise<T>): Promise<T> {
    return run(this);
  }
}

const db = new FakeDatabase();
const projection = new PostgresHomeCandidateProjection(db);
await projection.upsert({
  userId: 'user-1',
  careTrackId: 'care-1',
  relatedEntityId: '00000000-0000-4000-8000-000000000044',
  candidate: {
    id: 'care-card-1',
    domain: 'local',
    kind: 'status',
    title: '배송을 기다리고 있습니다',
    subjectRef: 'care:care-1',
    sourceRef: 'shipment:44',
    urgency: 1,
    importance: 2,
    relevance: 1,
    actionRequired: false,
    waitingState: true,
    confidence: 'confirmed',
    freshness: 'current',
    dedupeKey: 'care:care-1',
    clusterKey: 'care:care-1',
  },
});

assert(Number(db.queries.length) === 1, 'Home candidate upsert must use one database mutation.');
const upsert = db.queries[0];
assert(upsert?.sql.includes('on conflict (user_id, dedupe_key)'), 'Home candidate persistence must be idempotent by user + dedupe key.');
assert(upsert?.params[0] === 'user-1', 'Home candidate projection must preserve target user identity.');
assert(upsert?.params[4] === 'care-1', 'Home candidate projection must retain Care reference.');
assert(upsert?.params[9] === 'home', 'Quiet Care projection must persist Home as the default delivery hint.');
assert(upsert?.params[10] === 'care:care-1', 'Stable Care dedupe key must reach persistence.');
const payload = JSON.parse(String(upsert?.params[13]));
assert(payload.title === '배송을 기다리고 있습니다', 'Presentation payload must retain renderable title.');
assert(payload.waitingState === true, 'Presentation payload must retain waiting state.');
for (const forbidden of ['phone', 'email', 'address', 'paymentPayload', 'orderPayload']) {
  assert(!(forbidden in payload), `Home projection payload must not copy ${forbidden}.`);
}

await projection.remove({ userId: 'user-1', dedupeKey: 'care:care-1' });
assert(Number(db.queries.length) === 2, 'Removing terminal Care projection must use one delete mutation.');
assert(db.queries[1]?.sql.includes('delete from home_candidate'), 'Terminal projection must delete by projection identity.');
assert(db.queries[1]?.params[0] === 'user-1' && db.queries[1]?.params[1] === 'care:care-1', 'Removal must be scoped to user + dedupe key.');

console.log('PostgreSQL Home candidate projection tests passed.');
