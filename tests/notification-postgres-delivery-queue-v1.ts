import type { DatabasePort, QueryResult } from '../src/ports/databasePort.js';
import { PostgresNotificationDeliveryQueue } from '../src/notifications/postgresNotificationDeliveryQueue.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeDatabase implements DatabasePort {
  readonly queries: Array<{ sql: string; params: readonly unknown[] }> = [];
  nextRows: Record<string, unknown>[] = [{ id: 'delivery-1' }];

  async query<Row = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    this.queries.push({ sql, params });
    return { rows: this.nextRows as Row[] };
  }

  async transaction<T>(run: (tx: DatabasePort) => Promise<T>): Promise<T> {
    return run(this);
  }
}

const db = new FakeDatabase();
const queue = new PostgresNotificationDeliveryQueue(db);
const first = await queue.enqueueIfAbsent({
  dedupeKey: 'message-notification:message-1:00000000-0000-4000-8000-000000000201',
  recipientUserId: '00000000-0000-4000-8000-000000000201',
  envelope: {
    id: 'candidate-1:recipient-1',
    category: 'message',
    title: '새 메시지가 있습니다',
    target: 'palta://context/conv-1',
    occurredAt: '2026-09-17T23:30:00.000Z',
    collapseKey: 'message:conv-1',
  },
  notBefore: '2026-09-18T08:00:00-03:00',
});
assert(first.enqueued, 'Fresh notification delivery must report enqueued.');
assert(Number(db.queries.length) === 1, 'Notification queue must use one idempotent insert.');
const query = db.queries[0];
assert(query?.sql.includes('on conflict (recipient_user_id, dedupe_key) do nothing'), 'Notification queue must dedupe by recipient + semantic key.');
assert(query?.params[0] === '00000000-0000-4000-8000-000000000201', 'Queue must retain recipient user identity.');
assert(query?.params[1] === 'message', 'Queue must persist notification category.');
assert(query?.params[4] === '2026-09-18T08:00:00-03:00', 'Deferred notification must preserve not-before time.');
const envelope = JSON.parse(String(query?.params[3]));
assert(envelope.body === undefined, 'Generic message notification must not add a body preview implicitly.');
assert(envelope.target === 'palta://context/conv-1', 'Queued notification must retain provider-neutral Palta deep link.');

// DB unique conflict returns no row; retry is acknowledged without a second logical delivery.
db.nextRows = [];
const replay = await queue.enqueueIfAbsent({
  dedupeKey: 'message-notification:message-1:00000000-0000-4000-8000-000000000201',
  recipientUserId: '00000000-0000-4000-8000-000000000201',
  envelope: {
    id: 'candidate-1:recipient-1',
    category: 'message',
    title: '새 메시지가 있습니다',
    target: 'palta://context/conv-1',
    occurredAt: '2026-09-17T23:30:00.000Z',
  },
});
assert(!replay.enqueued, 'Duplicate notification retry must not create another delivery row.');

console.log('PostgreSQL notification delivery queue tests passed.');
