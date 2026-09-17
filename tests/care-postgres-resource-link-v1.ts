import type { DatabasePort, QueryResult } from '../src/ports/databasePort.js';
import { PostgresCareResourceLink } from '../src/care/postgresCareResourceLink.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeDatabase implements DatabasePort {
  mode: 'insert' | 'replay' = 'insert';
  queries: Array<{ sql: string; params: readonly unknown[] }> = [];

  async query<Row = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    this.queries.push({ sql, params });
    if (sql.includes('select user_id')) {
      return { rows: [{ user_id: 'user-1' }] as Row[] };
    }
    if (sql.includes('insert into care_resource_link')) {
      if (this.mode === 'replay') return { rows: [] as Row[] };
      return {
        rows: [{
          care_track_id: params[0],
          source_core: params[1],
          resource_type: params[2],
          resource_id: params[3],
          relation: params[4],
          linked_at: params[5],
        }] as Row[],
      };
    }
    if (sql.includes('from care_resource_link')) {
      return {
        rows: [{
          care_track_id: params[0],
          source_core: params[1],
          resource_type: params[2],
          resource_id: params[3],
          relation: params[4],
          linked_at: '2026-09-17T21:30:00.000Z',
        }] as Row[],
      };
    }
    throw new Error(`Unexpected SQL: ${sql}`);
  }

  async transaction<T>(run: (tx: DatabasePort) => Promise<T>): Promise<T> {
    return run(this);
  }
}

const db = new FakeDatabase();
const links = new PostgresCareResourceLink(db);
const owner = await links.findCareTrackOwner('care-1');
assert(owner === 'user-1', 'Care resource directory must resolve Care owner from care_track.user_id.');

const created = await links.attachIfAbsent({
  careTrackId: 'care-1',
  sourceCore: 'delivery-core',
  resourceType: 'shipment',
  resourceId: 'shipment-44',
  relation: 'subject',
  linkedAt: '2026-09-17T21:30:00.000Z',
});
assert(created.created, 'PostgreSQL Care link must report first insert as created.');
assert(
  db.queries.some((query) => query.sql.includes('on conflict')),
  'Care resource persistence must use database-level idempotency.',
);

db.mode = 'replay';
const queryCountBeforeReplay = db.queries.length;
const replay = await links.attachIfAbsent({
  careTrackId: 'care-1',
  sourceCore: 'delivery-core',
  resourceType: 'shipment',
  resourceId: 'shipment-44',
  relation: 'subject',
  linkedAt: '2026-09-17T21:31:00.000Z',
});
assert(!replay.created, 'Conflict replay must return the existing canonical Care link.');
assert(
  replay.link.linkedAt === '2026-09-17T21:30:00.000Z',
  'Conflict replay must retain the original linked_at timestamp.',
);
assert(
  Number(db.queries.length) === queryCountBeforeReplay + 2,
  'Conflict replay should perform one insert attempt plus one exact existing-link lookup.',
);

console.log('PostgreSQL Care resource-link tests passed.');
