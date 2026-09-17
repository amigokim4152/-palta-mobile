import type { DatabasePort, QueryResult } from '../src/ports/databasePort.js';
import {
  CareSignalApplyError,
  PostgresCareSignalApply,
} from '../src/care/postgresCareSignalApply.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeCareDatabase implements DatabasePort {
  track: Record<string, unknown> | null = {
    id: '00000000-0000-4000-8000-000000000001',
    state: 'waiting',
    waiting_for: 'slot_confirmation',
    expected_at: null,
    next_check_at: null,
  };
  links: Record<string, unknown>[] = [{
    relation: 'subject',
    last_signal_sequence: 10,
    last_signal_occurred_at: '2026-09-17T20:00:00.000Z',
  }];
  receipts = new Set<string>();
  trackUpdates: Array<readonly unknown[]> = [];
  linkUpdates: Array<readonly unknown[]> = [];
  receiptInserts: Array<{ params: readonly unknown[]; disposition: string }> = [];

  async query<Row = Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    if (sql.includes('from care_track') && sql.includes('for update')) {
      return { rows: (this.track ? [this.track] : []) as Row[] };
    }
    if (sql.includes('from care_resource_link') && sql.includes('for update')) {
      return { rows: this.links as Row[] };
    }
    if (sql.includes('from care_signal_receipt') && sql.includes('limit 1')) {
      const key = `${String(params[0])}|${String(params[1])}|${String(params[2])}`;
      return { rows: (this.receipts.has(key) ? [{ disposition: 'applied' }] : []) as Row[] };
    }
    if (sql.includes('update care_track')) {
      this.trackUpdates = [...this.trackUpdates, params];
      if (this.track) {
        this.track = {
          ...this.track,
          state: params[1],
          waiting_for: params[2],
          expected_at: params[3],
          next_check_at: params[4],
        };
      }
      return { rows: [] as Row[] };
    }
    if (sql.includes('update care_resource_link')) {
      this.linkUpdates = [...this.linkUpdates, params];
      this.links = this.links.map((row) => ({
        ...row,
        last_signal_sequence: params[4] ?? row.last_signal_sequence,
        last_signal_occurred_at: params[5],
      }));
      return { rows: [] as Row[] };
    }
    if (sql.includes('insert into care_signal_receipt')) {
      const key = `${String(params[0])}|${String(params[1])}|${String(params[2])}`;
      this.receipts.add(key);
      const disposition = sql.includes("'ignored_stale'") ? 'ignored_stale' : 'applied';
      this.receiptInserts.push({ params, disposition });
      return { rows: [] as Row[] };
    }
    throw new Error(`Unexpected SQL in fake Care database: ${sql}`);
  }

  async transaction<T>(run: (tx: DatabasePort) => Promise<T>): Promise<T> {
    return run(this);
  }
}

const db = new FakeCareDatabase();
const apply = new PostgresCareSignalApply(db);
const first = await apply.applySignal({
  careTrackId: '00000000-0000-4000-8000-000000000001',
  sourceSignalEventId: 'delivery-event-11',
  sourceCore: 'delivery-core',
  careEvent: 'schedule',
  resourceType: 'shipment',
  resourceId: 'shipment-44',
  occurredAt: '2026-09-17T21:00:00.000Z',
  sourceSequence: 11,
  expectedAt: '2026-09-18T16:00:00.000Z',
});
assert(first.changed && first.state === 'upcoming', 'Valid Care signal must advance the internal machine.');
assert(first.disposition === 'applied', 'Applied signal must report applied disposition.');
assert(db.trackUpdates.length === 1, 'Care state mutation must happen once.');
assert(db.trackUpdates[0]?.[1] === 'upcoming', 'Care track must persist detailed internal state.');
assert(db.trackUpdates[0]?.[3] === '2026-09-18T16:00:00.000Z', 'Schedule signal must persist expected time.');
assert(db.linkUpdates.length === 1 && db.linkUpdates[0]?.[4] === 11, 'Resource link must advance source sequence.');
assert(db.receiptInserts[0]?.disposition === 'applied', 'Applied signal must write an idempotency receipt.');

const replay = await apply.applySignal({
  careTrackId: '00000000-0000-4000-8000-000000000001',
  sourceSignalEventId: 'delivery-event-11',
  sourceCore: 'delivery-core',
  careEvent: 'schedule',
  resourceType: 'shipment',
  resourceId: 'shipment-44',
  occurredAt: '2026-09-17T21:00:00.000Z',
  sourceSequence: 11,
  expectedAt: '2026-09-18T16:00:00.000Z',
});
assert(!replay.changed && replay.disposition === 'replayed', 'Same signal event must be idempotent.');
assert(db.trackUpdates.length === 1, 'Replay must not mutate Care again.');

const stale = await apply.applySignal({
  careTrackId: '00000000-0000-4000-8000-000000000001',
  sourceSignalEventId: 'delivery-event-10-late',
  sourceCore: 'delivery-core',
  careEvent: 'begin',
  resourceType: 'shipment',
  resourceId: 'shipment-44',
  occurredAt: '2026-09-17T20:30:00.000Z',
  sourceSequence: 10,
});
assert(!stale.changed && stale.disposition === 'ignored_stale', 'Older source sequence must not regress Care.');
assert(db.trackUpdates.length === 1, 'Stale signal must not mutate Care state.');
assert(db.receiptInserts.at(-1)?.disposition === 'ignored_stale', 'Stale signal must remain auditable.');

let invalidRejected = false;
try {
  await apply.applySignal({
    careTrackId: '00000000-0000-4000-8000-000000000001',
    sourceSignalEventId: 'delivery-event-12-invalid',
    sourceCore: 'delivery-core',
    careEvent: 'result_received',
    resourceType: 'shipment',
    resourceId: 'shipment-44',
    occurredAt: '2026-09-17T21:30:00.000Z',
    sourceSequence: 12,
  });
} catch (error) {
  invalidRejected = error instanceof CareSignalApplyError && error.code === 'INVALID_SIGNAL';
}
assert(invalidRejected, 'Incompatible semantic signal must fail instead of silently inventing a transition.');
assert(
  !db.receipts.has('00000000-0000-4000-8000-000000000001|delivery-core|delivery-event-12-invalid'),
  'Invalid transition must not be acknowledged as applied.',
);

const missingLinkDb = new FakeCareDatabase();
missingLinkDb.links = [];
const missingLinkApply = new PostgresCareSignalApply(missingLinkDb);
let missingLinkRejected = false;
try {
  await missingLinkApply.applySignal({
    careTrackId: '00000000-0000-4000-8000-000000000001',
    sourceSignalEventId: 'unlinked-event',
    sourceCore: 'delivery-core',
    careEvent: 'wait',
    resourceType: 'shipment',
    resourceId: 'shipment-other',
    occurredAt: '2026-09-17T21:00:00.000Z',
  });
} catch (error) {
  missingLinkRejected = error instanceof CareSignalApplyError && error.code === 'RESOURCE_NOT_LINKED';
}
assert(missingLinkRejected, 'Care apply must re-check resource linkage inside the mutation transaction.');

console.log('PostgreSQL Care signal apply tests passed.');
