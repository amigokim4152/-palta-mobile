import type { EventBusPort, PaltaEvent, PaltaEventType } from '../src/events/eventBusPort.js';
import type { HomeCandidateProjectionPort } from '../src/home/homeCandidateProjectionPort.js';
import { startCareHomeProjectionConsumer } from '../src/care/careHomeProjectionConsumer.js';
import type {
  CareHomePresentationPort,
  CareHomeSnapshotPort,
} from '../src/care/careHomeProjectionPort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class InMemoryEventBus implements EventBusPort {
  private subscriptions: Array<{
    types: readonly PaltaEventType[];
    handler: (event: PaltaEvent) => Promise<void> | void;
    active: boolean;
  }> = [];

  async publish(event: PaltaEvent): Promise<void> {
    for (const subscription of this.subscriptions) {
      if (subscription.active && subscription.types.includes(event.type)) {
        await subscription.handler(event);
      }
    }
  }

  async subscribe(
    types: readonly PaltaEventType[],
    handler: (event: PaltaEvent) => Promise<void> | void,
  ): Promise<() => void> {
    const subscription = { types, handler, active: true };
    this.subscriptions.push(subscription);
    return () => { subscription.active = false; };
  }
}

let state: 'waiting' | 'outcome_recorded' = 'waiting';
const snapshots: CareHomeSnapshotPort = {
  async load(careTrackId) {
    if (careTrackId !== 'care-1') return null;
    return {
      userId: 'user-1',
      intentKey: 'delivery_tracking',
      subjectEntityId: '00000000-0000-4000-8000-000000000044',
      track: {
        id: 'care-1',
        state,
        ...(state === 'waiting' ? { waitingFor: 'delivery_arrival' } : {}),
      },
    };
  },
};

const presentationCalls: string[] = [];
const presentation: CareHomePresentationPort = {
  async present(input) {
    presentationCalls.push(input.snapshot.track.state);
    return {
      id: 'care-card-1',
      domain: 'local',
      title: input.snapshot.track.state === 'waiting'
        ? '배송을 기다리고 있습니다'
        : '배송이 완료되었습니다',
      sourceRef: 'shipment:44',
    };
  },
};

const upserts: Parameters<HomeCandidateProjectionPort['upsert']>[0][] = [];
const removals: Parameters<HomeCandidateProjectionPort['remove']>[0][] = [];
const sink: HomeCandidateProjectionPort = {
  async upsert(record) { upserts.push(record); },
  async remove(input) { removals.push(input); },
};

const eventBus = new InMemoryEventBus();
const consumer = await startCareHomeProjectionConsumer({
  eventBus,
  snapshots,
  presentation,
  sink,
});

await eventBus.publish({
  id: 'care-update-1',
  type: 'care.updated',
  occurredAt: '2026-09-17T21:40:00.000Z',
  source: 'care-core',
  payload: {
    careTrackId: 'care-1',
    sourceSignalEventId: 'shipment-event-17',
    state: 'waiting',
  },
});
assert(Number(upserts.length) === 1, 'Non-terminal Care update must upsert one Home candidate.');
assert(Number(removals.length) === 0, 'Active Care update must not remove its Home candidate.');
assert(upserts[0]?.candidate.dedupeKey === 'care:care-1', 'Care Home projection must use stable dedupe key.');
assert(upserts[0]?.candidate.waitingState === true, 'Canonical Care snapshot must drive waiting state.');
assert(upserts[0]?.relatedEntityId === '00000000-0000-4000-8000-000000000044', 'Related canonical entity must remain a reference.');

state = 'outcome_recorded';
await eventBus.publish({
  id: 'care-update-2',
  type: 'care.updated',
  occurredAt: '2026-09-17T22:00:00.000Z',
  source: 'care-core',
  payload: {
    careTrackId: 'care-1',
    sourceSignalEventId: 'shipment-event-18',
    state: 'outcome_recorded',
  },
});
assert(Number(upserts.length) === 1, 'Terminal Care should not append another Home candidate by default.');
assert(Number(removals.length) === 1, 'Terminal Care must remove the current Home projection by default.');
assert(removals[0]?.dedupeKey === 'care:care-1', 'Terminal removal must target the stable Care dedupe key.');

await eventBus.publish({
  id: 'malformed',
  type: 'care.updated',
  occurredAt: '2026-09-17T22:01:00.000Z',
  source: 'care-core',
  payload: {},
});
assert(Number(presentationCalls.length) === 2, 'Malformed care.updated must be ignored before snapshot/presentation work.');

await consumer.close();
state = 'waiting';
await eventBus.publish({
  id: 'after-close',
  type: 'care.updated',
  occurredAt: '2026-09-17T22:02:00.000Z',
  source: 'care-core',
  payload: { careTrackId: 'care-1' },
});
assert(Number(upserts.length) === 1, 'Closed Care Home consumer must stop projection work.');

console.log('Care Home projection consumer tests passed.');
