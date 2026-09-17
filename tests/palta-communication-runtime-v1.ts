import type { EventBusPort, PaltaEvent, PaltaEventType } from '../src/events/eventBusPort.js';
import { buildCanonicalResourceChangeEvent } from '../src/events/canonicalChangeContract.js';
import { buildCareSignalEvent } from '../src/care/careSignalContract.js';
import type { RealtimeAdapter, RealtimeSubscription } from '../src/messaging/realtimeAdapter.js';
import type { RealtimeEnvelope } from '../src/messaging/contracts.js';
import type { HomeCandidateProjectionPort } from '../src/home/homeCandidateProjectionPort.js';
import { startPaltaCommunicationRuntime } from '../src/runtime/paltaCommunicationRuntime.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class InMemoryEventBus implements EventBusPort {
  readonly published: PaltaEvent[] = [];
  private readonly subscriptions: Array<{
    types: readonly PaltaEventType[];
    handler: (event: PaltaEvent) => Promise<void> | void;
    active: boolean;
  }> = [];

  async publish(event: PaltaEvent): Promise<void> {
    this.published.push(event);
    const matching = this.subscriptions.filter(
      (subscription) => subscription.active && subscription.types.includes(event.type),
    );
    for (const subscription of matching) {
      await subscription.handler(event);
    }
  }

  async subscribe(
    types: readonly PaltaEventType[],
    handler: (event: PaltaEvent) => Promise<void> | void,
  ): Promise<() => void> {
    const subscription = { types, handler, active: true };
    this.subscriptions.push(subscription);
    return () => {
      subscription.active = false;
    };
  }
}

class FakeRealtime implements RealtimeAdapter {
  readonly envelopes: RealtimeEnvelope[] = [];

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
  async healthCheck(): Promise<{ ok: boolean }> {
    return { ok: true };
  }
}

const eventBus = new InMemoryEventBus();
const realtime = new FakeRealtime();
const timelineCommands: Array<Record<string, unknown>> = [];
const careApplications: Array<Record<string, unknown>> = [];
const homeUpserts: Parameters<HomeCandidateProjectionPort['upsert']>[0][] = [];
const homeRemovals: Parameters<HomeCandidateProjectionPort['remove']>[0][] = [];

const runtime = await startPaltaCommunicationRuntime({
  dependencies: {
    eventBus,
    realtime,
    timelineRouting: {
      async findTargetsForResource(input) {
        if (
          input.sourceCore === 'quote-core' &&
          input.resourceType === 'quote' &&
          input.resourceId === 'quote-1'
        ) {
          return [{ conversationId: 'conv-1', scopeId: 'scope-1' }];
        }
        return [];
      },
    },
    timelineProjection: {
      async projectDomainEvent(command) {
        timelineCommands.push({ ...command });
        return {
          event: {
            projectionId: 'projection-1',
            conversationId: command.conversationId,
            scopeId: command.scopeId,
            sequence: 9,
            sourceCore: command.sourceCore,
            eventId: command.domainEventId,
            eventType: command.eventType,
            resourceType: command.resource.resourceType,
            resourceId: command.resource.resourceId,
            occurredAt: command.occurredAt,
            projectedAt: command.projectedAt,
          },
          replayed: false,
        };
      },
    },
    careRouting: {
      async findTargetsForResource(input) {
        if (
          input.sourceCore === 'quote-core' &&
          input.resourceType === 'quote' &&
          input.resourceId === 'quote-1'
        ) {
          return [{ careTrackId: 'care-1' }];
        }
        return [];
      },
    },
    careApply: {
      async applySignal(input) {
        careApplications.push({ ...input });
        return {
          careTrackId: input.careTrackId,
          changed: true,
          state: input.careEvent === 'result_received' ? 'result_available' : 'waiting',
          disposition: 'applied',
        };
      },
    },
    careSnapshots: {
      async load(careTrackId) {
        if (careTrackId !== 'care-1') return null;
        return {
          userId: 'user-1',
          intentKey: 'service_quote',
          track: {
            id: 'care-1',
            state: 'result_available',
            result: {
              summary: '견적이 도착했습니다',
              observedAt: '2026-09-17T22:10:00.000Z',
            },
          },
        };
      },
    },
    carePresentation: {
      async present(input) {
        return {
          id: `care-card:${input.snapshot.track.id}`,
          domain: 'local',
          title: '견적이 도착했습니다',
          sourceRef: 'quote:quote-1',
          action: {
            label: '견적 보기',
            target: '/quotes/quote-1',
            kind: 'internal',
          },
        };
      },
    },
    homeProjection: {
      async upsert(record) {
        homeUpserts.push(record);
      },
      async remove(input) {
        homeRemovals.push(input);
      },
    },
  },
  options: {
    now: () => '2026-09-17T22:10:01.000Z',
    maxTimelineTargets: 25,
    maxCareTargets: 25,
  },
});

await eventBus.publish({
  id: 'message-outbox-1',
  type: 'message.created',
  occurredAt: '2026-09-17T22:00:00.000Z',
  source: 'message-core',
  payload: {
    conversationId: 'conv-1',
    scopeId: 'scope-1',
    sequence: 8,
    messageId: 'message-8',
  },
});
assert(Number(realtime.envelopes.length) === 1, 'Message runtime must route message.created to realtime.');
assert(realtime.envelopes[0]?.kind === 'message_created', 'Realtime message kind must be preserved.');
assert(
  eventBus.published.some((event) => event.type === 'notification.candidate'),
  'Human message must create a notification candidate without directly sending push.',
);

await eventBus.publish(
  buildCanonicalResourceChangeEvent({
    eventId: 'quote-event-1',
    sourceCore: 'quote-core',
    resourceType: 'quote',
    resourceId: 'quote-1',
    changeType: 'quote.received',
    occurredAt: '2026-09-17T22:10:00.000Z',
  }),
);
assert(Number(timelineCommands.length) === 1, 'Canonical quote change must route to the linked conversation scope.');
assert(timelineCommands[0]?.conversationId === 'conv-1', 'Timeline projection must preserve relationship conversation.');
assert(timelineCommands[0]?.scopeId === 'scope-1', 'Timeline projection must preserve work scope.');

await eventBus.publish(
  buildCareSignalEvent({
    eventId: 'quote-care-signal-1',
    sourceCore: 'quote-core',
    resourceType: 'quote',
    resourceId: 'quote-1',
    careEvent: 'result_received',
    occurredAt: '2026-09-17T22:10:00.000Z',
    sourceSequence: 2,
    resultRef: 'quote:quote-1',
  }),
);
assert(Number(careApplications.length) === 1, 'Explicit care.signal must apply to the linked Care track.');
assert(careApplications[0]?.careTrackId === 'care-1', 'Care routing must resolve the linked Care track.');
assert(Number(homeUpserts.length) === 1, 'Changed Care state must project one idempotent Home candidate.');
assert(Number(homeRemovals.length) === 0, 'Result-available Care must remain visible on Home.');
assert(homeUpserts[0]?.candidate.dedupeKey === 'care:care-1', 'Home projection must retain stable Care dedupe identity.');
assert(homeUpserts[0]?.candidate.action?.label === '견적 보기', 'Domain presenter must own user-facing action copy.');

const beforeClose = {
  realtime: realtime.envelopes.length,
  timeline: timelineCommands.length,
  care: careApplications.length,
  home: homeUpserts.length,
};
await runtime.close();
await eventBus.publish({
  id: 'after-close',
  type: 'message.created',
  occurredAt: '2026-09-17T22:20:00.000Z',
  source: 'message-core',
  payload: {
    conversationId: 'conv-1',
    sequence: 10,
    messageId: 'message-10',
  },
});
assert(realtime.envelopes.length === beforeClose.realtime, 'Closed runtime must stop realtime consumption.');
assert(timelineCommands.length === beforeClose.timeline, 'Closed runtime must stop timeline routing.');
assert(careApplications.length === beforeClose.care, 'Closed runtime must stop Care routing.');
assert(homeUpserts.length === beforeClose.home, 'Closed runtime must stop Home projection.');

console.log('Palta communication runtime composition tests passed.');
