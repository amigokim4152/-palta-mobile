import type { EventBusPort, PaltaEvent, PaltaEventType } from '../src/events/eventBusPort.js';
import type { RealtimeAdapter, RealtimeSubscription } from '../src/messaging/realtimeAdapter.js';
import type { RealtimeEnvelope } from '../src/messaging/contracts.js';
import type { HomeCandidateProjectionPort } from '../src/home/homeCandidateProjectionPort.js';
import { transitionCare, type CareEvent, type CareTrack } from '../src/care/careMachine.js';
import { startPaltaCommunicationRuntime } from '../src/runtime/paltaCommunicationRuntime.js';
import {
  buildQuoteRequestOpenedEvents,
  buildQuoteResponsesAvailableEvents,
  buildQuoteSelectedEvents,
} from '../src/serviceExchange/quoteLifecycleEvents.js';
import {
  buildServiceAppointmentRequestedEvents,
  buildServiceAppointmentConfirmedEvents,
  buildServiceAppointmentStartedEvents,
  buildServiceAppointmentCompletedEvents,
  buildServiceAppointmentOutcomeRecordedEvents,
} from '../src/serviceExchange/serviceAppointmentLifecycleEvents.js';

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
    for (const subscription of matching) await subscription.handler(event);
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

class NoopRealtime implements RealtimeAdapter {
  async publish(_envelope: RealtimeEnvelope): Promise<void> {}
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

function advanceTrack(
  current: CareTrack,
  event: CareEvent,
  input: { waitingForKey?: string; expectedAt?: string },
): CareTrack {
  const next = transitionCare(current, event);
  if (event === 'wait') {
    return {
      ...next,
      ...(input.waitingForKey !== undefined
        ? { waitingFor: input.waitingForKey }
        : {}),
    };
  }
  if (event === 'schedule') {
    return {
      ...next,
      ...(input.expectedAt !== undefined ? { expectedAt: input.expectedAt } : {}),
    };
  }
  if (
    event === 'start_action' ||
    event === 'begin' ||
    event === 'result_received' ||
    event === 'complete' ||
    event === 'record_outcome' ||
    event === 'cancel'
  ) {
    const { waitingFor: _waitingFor, expectedAt: _expectedAt, ...rest } = next;
    return rest;
  }
  return next;
}

const eventBus = new InMemoryEventBus();
let careTrack: CareTrack = {
  id: 'care-service-1',
  // A quote request is a confirmed user action, so Care creation starts here.
  state: 'action_started',
};
let timelineSequence = 0;
const timelineChanges: string[] = [];
const careStates: string[] = [careTrack.state];
const homeUpserts: Parameters<HomeCandidateProjectionPort['upsert']>[0][] = [];
const homeRemovals: Parameters<HomeCandidateProjectionPort['remove']>[0][] = [];

const runtime = await startPaltaCommunicationRuntime({
  dependencies: {
    eventBus,
    realtime: new NoopRealtime(),
    timelineRouting: {
      async findTargetsForResource(input) {
        const quote =
          input.sourceCore === 'service-exchange' &&
          input.resourceType === 'quote_request' &&
          input.resourceId === 'quote-request-1';
        const appointment =
          input.sourceCore === 'service-appointment' &&
          input.resourceType === 'service_appointment' &&
          input.resourceId === 'appointment-1';
        return quote || appointment
          ? [{ conversationId: 'conv-user-taller', scopeId: 'scope-repair-1' }]
          : [];
      },
    },
    timelineProjection: {
      async projectDomainEvent(command) {
        timelineChanges.push(command.eventType);
        timelineSequence += 1;
        return {
          event: {
            projectionId: `projection-${timelineSequence}`,
            conversationId: command.conversationId,
            scopeId: command.scopeId,
            sequence: timelineSequence,
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
        const quote =
          input.sourceCore === 'service-exchange' &&
          input.resourceType === 'quote_request' &&
          input.resourceId === 'quote-request-1';
        const appointment =
          input.sourceCore === 'service-appointment' &&
          input.resourceType === 'service_appointment' &&
          input.resourceId === 'appointment-1';
        return quote || appointment ? [{ careTrackId: careTrack.id }] : [];
      },
    },
    careApply: {
      async applySignal(input) {
        careTrack = advanceTrack(careTrack, input.careEvent, {
          ...(input.waitingForKey !== undefined
            ? { waitingForKey: input.waitingForKey }
            : {}),
          ...(input.expectedAt !== undefined ? { expectedAt: input.expectedAt } : {}),
        });
        careStates.push(careTrack.state);
        return {
          careTrackId: careTrack.id,
          changed: true,
          state: careTrack.state,
          disposition: 'applied',
        };
      },
    },
    careSnapshots: {
      async load(careTrackId) {
        if (careTrackId !== careTrack.id) return null;
        return {
          userId: 'user-1',
          intentKey: 'local_business_service',
          subjectEntityId: '00000000-0000-4000-8000-000000000101',
          track: { ...careTrack },
        };
      },
    },
    carePresentation: {
      async present({ snapshot }) {
        const state = snapshot.track.state;
        const titleByState: Record<string, string> = {
          waiting: '업체의 견적을 기다리고 있습니다',
          result_available: '견적이 도착했습니다',
          follow_up: '견적을 선택했습니다. 예약을 진행하세요',
          action_started: '예약을 진행하고 있습니다',
          upcoming: '방문 예약이 확정되었습니다',
          in_progress: '작업이 진행 중입니다',
          completed: '작업이 완료되었습니다',
          outcome_recorded: '처리가 완료되었습니다',
        };
        return {
          id: `care-card:${snapshot.track.id}`,
          domain: 'local',
          title: titleByState[state] ?? '서비스 진행 상태',
          sourceRef: state === 'waiting' || state === 'result_available' || state === 'follow_up'
            ? 'quote_request:quote-request-1'
            : 'service_appointment:appointment-1',
          ...(state === 'result_available'
            ? {
                action: {
                  label: '견적 보기',
                  target: '/quotes/quote-request-1',
                  kind: 'internal' as const,
                },
              }
            : {}),
          ...(state === 'follow_up'
            ? {
                action: {
                  label: '예약 진행',
                  target: '/appointments/new?quote=quote-request-1',
                  kind: 'internal' as const,
                },
              }
            : {}),
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
    now: () => '2026-09-17T23:00:00.000Z',
  },
});

async function publishPair(pair: readonly [PaltaEvent, PaltaEvent]): Promise<void> {
  await eventBus.publish(pair[0]);
  await eventBus.publish(pair[1]);
}

await publishPair(
  buildQuoteRequestOpenedEvents({
    quoteRequestId: 'quote-request-1',
    occurredAt: '2026-09-17T20:00:00.000Z',
    sourceSequence: 1,
  }),
);
assert(careTrack.state === 'waiting', 'Confirmed quote request must transition Care from action_started to waiting.');
assert(homeUpserts.at(-1)?.candidate.title === '업체의 견적을 기다리고 있습니다', 'Home must show quiet waiting status.');

await publishPair(
  buildQuoteResponsesAvailableEvents({
    quoteRequestId: 'quote-request-1',
    occurredAt: '2026-09-17T20:20:00.000Z',
    sourceSequence: 2,
  }),
);
assert(careTrack.state === 'result_available', 'Quote response must move Care to result_available.');
assert(homeUpserts.at(-1)?.candidate.action?.label === '견적 보기', 'Result must expose the domain-owned quote action.');

await publishPair(
  buildQuoteSelectedEvents({
    quoteRequestId: 'quote-request-1',
    occurredAt: '2026-09-17T20:30:00.000Z',
    sourceSequence: 3,
  }),
);
assert(careTrack.state === 'follow_up', 'Selecting quote must move the service journey into follow_up.');
assert(homeUpserts.at(-1)?.candidate.action?.label === '예약 진행', 'Follow-up must guide the user toward booking without forcing a push.');

await publishPair(
  buildServiceAppointmentRequestedEvents({
    appointmentId: 'appointment-1',
    occurredAt: '2026-09-17T20:35:00.000Z',
    sourceSequence: 1,
  }),
);
assert(careTrack.state === 'action_started', 'Booking request must resume the same service Care journey.');

await publishPair(
  buildServiceAppointmentConfirmedEvents({
    appointmentId: 'appointment-1',
    scheduledAt: '2026-09-19T10:30:00-03:00',
    occurredAt: '2026-09-17T20:40:00.000Z',
    sourceSequence: 2,
  }),
);
assert(careTrack.state === 'upcoming', 'Confirmed appointment must become upcoming.');
assert(careTrack.expectedAt === '2026-09-19T10:30:00-03:00', 'Confirmed appointment time must remain structured Care timing.');

await publishPair(
  buildServiceAppointmentStartedEvents({
    appointmentId: 'appointment-1',
    occurredAt: '2026-09-19T10:35:00-03:00',
    sourceSequence: 3,
  }),
);
assert(careTrack.state === 'in_progress', 'Service start must move Care into in_progress.');

await publishPair(
  buildServiceAppointmentCompletedEvents({
    appointmentId: 'appointment-1',
    occurredAt: '2026-09-19T13:00:00-03:00',
    sourceSequence: 4,
  }),
);
assert(careTrack.state === 'completed', 'Service completion must move Care to completed.');
assert(homeUpserts.at(-1)?.candidate.title === '작업이 완료되었습니다', 'Completed work may remain briefly visible as a result.');

await publishPair(
  buildServiceAppointmentOutcomeRecordedEvents({
    appointmentId: 'appointment-1',
    occurredAt: '2026-09-19T13:05:00-03:00',
    outcomeRef: 'service_record:record-1',
    sourceSequence: 5,
  }),
);
assert(careTrack.state === 'outcome_recorded', 'Recorded durable outcome must terminate the active Care journey.');
assert(Number(homeRemovals.length) === 1, 'Terminal outcome must remove the active Home projection.');
assert(homeRemovals[0]?.dedupeKey === 'care:care-service-1', 'Terminal cleanup must target the stable Care projection identity.');

assert(
  JSON.stringify(careStates) === JSON.stringify([
    'action_started',
    'waiting',
    'result_available',
    'follow_up',
    'action_started',
    'upcoming',
    'in_progress',
    'completed',
    'outcome_recorded',
  ]),
  'Vertical slice must preserve the intended Care lifecycle ordering.',
);
assert(Number(timelineChanges.length) === 8, 'Every canonical quote/appointment transition must remain visible in the scoped timeline.');
assert(
  timelineChanges[0] === 'quote_request.opened' &&
    timelineChanges.at(-1) === 'service_appointment.outcome_recorded',
  'Timeline must span the quote and appointment domains without changing conversation/scope ownership.',
);

await runtime.close();
console.log('Local business quote-to-appointment E2E tests passed.');
