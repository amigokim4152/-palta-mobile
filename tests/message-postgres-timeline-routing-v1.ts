import type { DatabasePort, QueryResult } from '../src/ports/databasePort.js';
import {
  PostgresTimelineRouting,
  TimelineRoutingFanoutError,
} from '../src/messaging/postgresTimelineRouting.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class RecordingDatabase implements DatabasePort {
  readonly calls: Array<{ sql: string; params?: readonly unknown[] }> = [];

  constructor(private readonly rows: Array<Record<string, unknown>>) {}

  async query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<Row>> {
    this.calls.push({ sql: sql.replace(/\s+/g, ' ').trim(), ...(params ? { params } : {}) });
    return { rows: this.rows as Row[] };
  }

  async transaction<T>(run: (tx: DatabasePort) => Promise<T>): Promise<T> {
    return run(this);
  }
}

const db = new RecordingDatabase([
  { conversation_id: 'conv-1', scope_id: 'scope-1' },
  { conversation_id: 'conv-2', scope_id: 'scope-2' },
]);
const routing = new PostgresTimelineRouting(db);
const targets = await routing.findTargetsForResource({
  sourceCore: 'commerce',
  resourceType: 'shipment',
  resourceId: 'shipment-1001',
  maxTargets: 40,
});
assert(targets.length === 2, 'Indexed routing must return linked relationship Scopes.');
assert(targets[0]?.conversationId === 'conv-1' && targets[0]?.scopeId === 'scope-1', 'Routing must map database identities exactly.');
assert(Number(db.calls.length) === 1, 'Reverse routing must use one indexed database query.');
const call = db.calls[0]!;
assert(call.sql.includes('from msg_scope_resource r'), 'Routing must originate from the authorized Scope resource index.');
assert(call.sql.includes('join msg_conversation_scope s'), 'Routing must resolve the owning Conversation through Scope.');
assert(call.sql.includes("s.scope_state in ('active', 'resolved')"), 'Archived Scopes must be excluded from event projection routing.');
assert(call.params?.[0] === 'commerce', 'Query must constrain source Core.');
assert(call.params?.[1] === 'shipment', 'Query must constrain resource type.');
assert(call.params?.[2] === 'shipment-1001', 'Query must constrain resource identity.');
assert(call.params?.[3] === 41, 'Query must request one row beyond the configured fan-out limit to detect overflow.');

const overflowRows = Array.from({ length: 4 }, (_, index) => ({
  conversation_id: `conv-${index + 1}`,
  scope_id: `scope-${index + 1}`,
}));
const overflowDb = new RecordingDatabase(overflowRows);
const overflowRouting = new PostgresTimelineRouting(overflowDb);
let overflowThrown = false;
try {
  await overflowRouting.findTargetsForResource({
    sourceCore: 'community',
    resourceType: 'announcement',
    resourceId: 'announcement-broadcast-like',
    maxTargets: 3,
  });
} catch (error) {
  overflowThrown = true;
  assert(error instanceof TimelineRoutingFanoutError, 'Excessive relationship fan-out must raise the dedicated error.');
  assert(error.maxTargets === 3, 'Fan-out error must preserve the configured relationship limit.');
}
assert(overflowThrown, 'Timeline routing must reject broadcast-like fan-out.');
assert(overflowDb.calls[0]?.params?.[3] === 4, 'Overflow detection query must request limit + 1.');

const hardCapRows = Array.from({ length: 101 }, (_, index) => ({
  conversation_id: `conv-cap-${index + 1}`,
  scope_id: `scope-cap-${index + 1}`,
}));
const hardCapDb = new RecordingDatabase(hardCapRows);
const hardCapRouting = new PostgresTimelineRouting(hardCapDb);
try {
  await hardCapRouting.findTargetsForResource({
    sourceCore: 'commerce',
    resourceType: 'shipment',
    resourceId: 'shipment-too-wide',
    maxTargets: 1000,
  });
  throw new Error('Expected hard fan-out cap.');
} catch (error) {
  assert(error instanceof TimelineRoutingFanoutError, 'Configured limits above v1 cap must still enforce hard cap.');
  assert(error.maxTargets === 100, 'v1 hard fan-out cap must remain 100.');
}
assert(hardCapDb.calls[0]?.params?.[3] === 101, 'Hard cap query must never request more than 101 routing rows.');

console.log('Message PostgreSQL timeline routing tests passed.');
