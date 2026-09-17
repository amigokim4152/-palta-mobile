import {
  CareTrackStartService,
  initialCareStateForMode,
  type CareTrackStartRecord,
  type CareTrackStartStore,
} from '../src/care/careTrackStartService.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class InMemoryCareStartStore implements CareTrackStartStore {
  readonly records = new Map<string, CareTrackStartRecord>();

  async openOrReuse(record: CareTrackStartRecord) {
    const key = record.clientRequestId
      ? `${record.userId}:${record.clientRequestId}`
      : record.careTrackId;
    const existing = this.records.get(key);
    if (existing) {
      if (
        existing.intentKey !== record.intentKey ||
        existing.subjectEntityId !== record.subjectEntityId
      ) {
        throw new Error('IDEMPOTENCY_CONFLICT');
      }
      return {
        track: { id: existing.careTrackId, state: existing.initialState },
        created: false,
      };
    }
    this.records.set(key, record);
    return {
      track: { id: record.careTrackId, state: record.initialState },
      created: true,
    };
  }
}

assert(initialCareStateForMode('discover') === 'discovered', 'Passive discovery must not pretend an action started.');
assert(initialCareStateForMode('confirmed_action') === 'action_started', 'Confirmed user action must start in action_started state.');

const store = new InMemoryCareStartStore();
let id = 0;
const service = new CareTrackStartService(store, {
  nextCareTrackId: () => `care-${++id}`,
  now: () => '2026-09-17T22:00:00.000Z',
});

const first = await service.start({
  userId: 'user-1',
  intentKey: 'local_business_quote',
  mode: 'confirmed_action',
  subjectEntityId: '00000000-0000-4000-8000-000000000101',
  clientRequestId: 'offline-mutation-1',
});
assert(first.created, 'First confirmed action must create a Care track.');
assert(first.track.state === 'action_started', 'Quote action must be ready for a subsequent wait signal.');

const replay = await service.start({
  userId: 'user-1',
  intentKey: 'local_business_quote',
  mode: 'confirmed_action',
  subjectEntityId: '00000000-0000-4000-8000-000000000101',
  clientRequestId: 'offline-mutation-1',
});
assert(!replay.created, 'Offline retry must reuse the same Care track.');
assert(replay.track.id === first.track.id, 'Idempotent retry must return the original Care identity.');
assert(Number(store.records.size) === 1, 'Retry must not create a second lifecycle record.');

let conflict = false;
try {
  await service.start({
    userId: 'user-1',
    intentKey: 'different_intent',
    mode: 'confirmed_action',
    subjectEntityId: '00000000-0000-4000-8000-000000000101',
    clientRequestId: 'offline-mutation-1',
  });
} catch {
  conflict = true;
}
assert(conflict, 'Reusing an idempotency key for a different intent must be rejected.');

console.log('Care track start tests passed.');
