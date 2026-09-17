import type { EventBusPort, PaltaEvent, PaltaEventType } from '../src/events/eventBusPort.js';
import { startMessageEventConsumers } from '../src/messaging/messageEventConsumers.js';
import type {
  RealtimeAdapter,
  RealtimeSubscription,
} from '../src/messaging/realtimeAdapter.js';
import type { RealtimeEnvelope } from '../src/messaging/contracts.js';

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

class FakeRealtime implements RealtimeAdapter {
  envelopes: RealtimeEnvelope[] = [];

  async publish(envelope: RealtimeEnvelope): Promise<void> {
    this.envelopes.push(envelope);
  }

  async subscribe(
    _conversationId: string,
    _onEnvelope: (envelope: RealtimeEnvelope) => void,
  ): Promise<RealtimeSubscription> {
    return { close() {} };
  }

  async publishTyping(): Promise<void> {}
  async publishPresence(): Promise<void> {}
  async healthCheck(): Promise<{ ok: boolean }> { return { ok: true }; }
}

const eventBus = new InMemoryEventBus();
const realtime = new FakeRealtime();
const consumers = await startMessageEventConsumers({ eventBus, realtime });

await eventBus.publish({
  id: 'outbox-message-1',
  type: 'message.created',
  occurredAt: '2026-09-17T20:00:00.000Z',
  source: 'message-core',
  subjectRef: 'conversation:conv-1',
  dedupeKey: 'message-outbox:outbox-message-1',
  payload: {
    conversationId: 'conv-1',
    scopeId: 'scope-shipment-1',
    sequence: 8,
    messageId: 'message-8',
  },
});
assert(Number(realtime.envelopes.length) === 1, 'message.created must publish one realtime envelope.');
assert(realtime.envelopes[0]?.kind === 'message_created', 'Realtime envelope kind must be message_created.');
assert(realtime.envelopes[0]?.scopeId === 'scope-shipment-1', 'Realtime envelope must preserve message scope.');
assert(realtime.envelopes[0]?.refId === 'message-8', 'Realtime envelope must reference canonical message.');

const candidates = eventBus.published.filter((event) => event.type === 'notification.candidate');
assert(Number(candidates.length) === 1, 'message.created must create one notification candidate.');
const candidate = candidates[0];
assert(candidate?.dedupeKey === 'message-notification:message-8', 'Notification candidate dedupe key must be stable per message.');
assert(candidate?.payload.sourceEventId === 'outbox-message-1', 'Notification candidate must retain source event identity.');
assert(candidate?.payload.conversationId === 'conv-1', 'Notification candidate must carry routing context.');
const candidateJson = JSON.stringify(candidate).toLowerCase();
for (const forbidden of ['body', 'phone', 'email', 'address', 'token', 'bearer']) {
  assert(!candidateJson.includes(forbidden), `Notification candidate must not copy ${forbidden} or secret content.`);
}

await eventBus.publish({
  id: 'outbox-read-1',
  type: 'message.read_advanced',
  occurredAt: '2026-09-17T20:01:00.000Z',
  source: 'message-core',
  subjectRef: 'conversation:conv-1',
  dedupeKey: 'message-outbox:outbox-read-1',
  payload: {
    conversationId: 'conv-1',
    actorType: 'user',
    actorId: 'user-1',
    throughSequence: 8,
  },
});
assert(Number(realtime.envelopes.length) === 2, 'read advancement must publish one realtime envelope.');
assert(realtime.envelopes[1]?.kind === 'read_advanced', 'Read realtime kind must be read_advanced.');
assert(realtime.envelopes[1]?.sequence === 8, 'Read realtime cursor must preserve throughSequence.');
assert(realtime.envelopes[1]?.refId === 'user:user-1', 'Read realtime ref must identify participant actor.');
assert(Number(eventBus.published.filter((event) => event.type === 'notification.candidate').length) === 1, 'Read events must never create push/notification candidates.');

await eventBus.publish({
  id: 'outbox-domain-event-1',
  type: 'message.domain_event_projected',
  occurredAt: '2026-09-17T20:01:30.000Z',
  source: 'message-core',
  subjectRef: 'conversation:conv-1',
  dedupeKey: 'message-outbox:outbox-domain-event-1',
  payload: {
    conversationId: 'conv-1',
    scopeId: 'scope-shipment-1',
    sequence: 9,
    projectionId: 'projection-9',
    domainEventId: 'shipment-event-9',
    eventType: 'shipment.out_for_delivery',
    sourceCore: 'commerce',
    resourceType: 'shipment',
    resourceId: 'shipment-1001',
  },
});
assert(Number(realtime.envelopes.length) === 3, 'Projected domain event must publish one realtime envelope.');
assert(realtime.envelopes[2]?.kind === 'domain_event', 'Projected domain event realtime kind must stay distinct from human messages.');
assert(realtime.envelopes[2]?.scopeId === 'scope-shipment-1', 'Projected domain event must preserve Scope routing.');
assert(realtime.envelopes[2]?.sequence === 9, 'Projected domain event must preserve canonical Conversation sequence.');
assert(realtime.envelopes[2]?.refId === 'projection-9', 'Realtime domain event must reference durable projection row.');
assert(
  Number(eventBus.published.filter((event) => event.type === 'notification.candidate').length) === 1,
  'Timeline domain projection alone must not force a push/notification candidate.',
);

await eventBus.publish({
  id: 'invalid-message-event',
  type: 'message.created',
  occurredAt: '2026-09-17T20:02:00.000Z',
  source: 'message-core',
  payload: { conversationId: 'conv-1' },
});
assert(Number(realtime.envelopes.length) === 3, 'Malformed event must be ignored by realtime consumer.');
assert(Number(eventBus.published.filter((event) => event.type === 'notification.candidate').length) === 1, 'Malformed event must not create notification candidate.');

await consumers.close();
await eventBus.publish({
  id: 'after-close',
  type: 'message.created',
  occurredAt: '2026-09-17T20:03:00.000Z',
  source: 'message-core',
  payload: { conversationId: 'conv-1', sequence: 10, messageId: 'message-10' },
});
assert(Number(realtime.envelopes.length) === 3, 'Closed consumers must stop realtime delivery.');
assert(Number(eventBus.published.filter((event) => event.type === 'notification.candidate').length) === 1, 'Closed consumers must stop notification candidate creation.');

console.log('Message event consumer tests passed.');
