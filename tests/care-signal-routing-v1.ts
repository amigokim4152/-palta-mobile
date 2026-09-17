import type { EventBusPort, PaltaEvent, PaltaEventType } from '../src/events/eventBusPort.js';
import { buildCareSignalEvent } from '../src/care/careSignalContract.js';
import { startCareSignalConsumer } from '../src/care/careSignalConsumer.js';
import type { CareSignalApplyPort } from '../src/care/careSignalApplyPort.js';
import type { CareSignalRoutingPort } from '../src/care/careSignalRoutingPort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class InMemoryEventBus implements EventBusPort {
  published: PaltaEvent[] = [];
  private subscriptions: Array<{
    types: readonly PaltaEventType[];
    handler: (event: PaltaEvent) => Promise<void> | void;
    active: boolean;
  }> = [];

  async publish(event: PaltaEvent): Promise<void> {
    this.published.push(event);
    const matching = this.subscriptions.filter(
      (subscription) => subscription.active && subscription.types.includes(event.type),
    );
    for (const subscription of matching) await subscription.handler(event);
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

const routed: Array<{
  sourceCore: string;
  resourceType: string;
  resourceId: string;
  maxTargets: number;
}> = [];
const routing: CareSignalRoutingPort = {
  async findTargetsForResource(input) {
    routed.push(input);
    if (input.resourceId === 'shipment-none') return [];
    return [{ careTrackId: 'care-1' }, { careTrackId: 'care-2' }];
  },
};

const applied: Array<Parameters<CareSignalApplyPort['applySignal']>[0]> = [];
let replay = false;
const apply: CareSignalApplyPort = {
  async applySignal(input) {
    applied.push(input);
    if (input.careTrackId === 'care-2') {
      return { careTrackId: input.careTrackId, changed: false };
    }
    return {
      careTrackId: input.careTrackId,
      changed: !replay,
      state: 'waiting',
    };
  },
};

const eventBus = new InMemoryEventBus();
const consumers = await startCareSignalConsumer({
  eventBus,
  routing,
  apply,
  runtime: { maxTargets: 25 },
});

const signal = buildCareSignalEvent({
  eventId: 'shipment-event-17',
  sourceCore: 'delivery-core',
  resourceType: 'shipment',
  resourceId: 'shipment-44',
  careEvent: 'wait',
  occurredAt: '2026-09-17T21:15:00.000Z',
  sourceSequence: 17,
  expectedAt: '2026-09-18T16:00:00.000Z',
  waitingForKey: 'delivery_arrival',
});
await eventBus.publish(signal);

assert(Number(routed.length) === 1, 'Valid care.signal must perform one resource reverse lookup.');
assert(routed[0]?.maxTargets === 25, 'Care routing must honor the bounded v1 fan-out.');
assert(Number(applied.length) === 2, 'Signal must be offered to every linked Care track.');
assert(
  applied[0]?.sourceSignalEventId === 'shipment-event-17' &&
    applied[0]?.careEvent === 'wait' &&
    applied[0]?.sourceSequence === 17 &&
    applied[0]?.expectedAt === '2026-09-18T16:00:00.000Z',
  'Care apply command must preserve semantic signal, ordering and idempotency identity.',
);

const updates = eventBus.published.filter((event) => event.type === 'care.updated');
assert(Number(updates.length) === 1, 'Only changed Care tracks must emit care.updated.');
assert(updates[0]?.subjectRef === 'care:care-1', 'care.updated must address the changed Care track.');
assert(
  !eventBus.published.some((event) => event.type === 'notification.candidate'),
  'Care signal consumption must not bypass Notification policy.',
);

const signalJson = JSON.stringify(signal).toLowerCase();
for (const forbidden of ['phone', 'email', 'address', 'messagebody', 'paymentpayload']) {
  assert(!signalJson.includes(forbidden), `Care signal must not copy ${forbidden}.`);
}

replay = true;
await eventBus.publish(signal);
assert(
  Number(eventBus.published.filter((event) => event.type === 'care.updated').length) === 1,
  'Idempotent replay must not emit another care.updated when apply reports no change.',
);

await eventBus.publish({
  id: 'bad-care-signal',
  type: 'care.signal',
  occurredAt: '2026-09-17T21:16:00.000Z',
  source: 'delivery-core',
  payload: { resourceType: 'shipment' },
});
assert(Number(routed.length) === 2, 'Malformed care.signal must be ignored before resource routing.');

await eventBus.publish(buildCareSignalEvent({
  eventId: 'unlinked-event',
  sourceCore: 'delivery-core',
  resourceType: 'shipment',
  resourceId: 'shipment-none',
  careEvent: 'complete',
  occurredAt: '2026-09-17T21:17:00.000Z',
}));
assert(Number(applied.length) === 4, 'Unlinked resource must not fabricate a Care track or mutation.');

await consumers.close();
await eventBus.publish(buildCareSignalEvent({
  eventId: 'after-close',
  sourceCore: 'delivery-core',
  resourceType: 'shipment',
  resourceId: 'shipment-44',
  careEvent: 'complete',
  occurredAt: '2026-09-17T21:18:00.000Z',
}));
assert(Number(routed.length) === 3, 'Closed Care signal consumer must stop routing new signals.');

console.log('Care signal routing tests passed.');
