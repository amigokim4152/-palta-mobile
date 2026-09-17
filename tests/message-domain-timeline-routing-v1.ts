import {
  buildCanonicalResourceChangeEvent,
} from '../src/events/canonicalChangeContract.js';
import type {
  EventBusPort,
  PaltaEvent,
  PaltaEventType,
} from '../src/events/eventBusPort.js';
import {
  startDomainTimelineProjectionConsumer,
  type DomainTimelineProjectionPort,
} from '../src/messaging/domainTimelineProjectionConsumer.js';
import type {
  ProjectDomainEventCommand,
  ProjectDomainEventResult,
} from '../src/messaging/conversationTimelineService.js';
import type {
  TimelineProjectionTarget,
  TimelineRoutingPort,
} from '../src/messaging/timelineRoutingPort.js';

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

class FakeRouting implements TimelineRoutingPort {
  targets: TimelineProjectionTarget[] = [];
  requests: Array<{
    sourceCore: string;
    resourceType: string;
    resourceId: string;
    maxTargets: number;
  }> = [];

  async findTargetsForResource(input: {
    sourceCore: string;
    resourceType: string;
    resourceId: string;
    maxTargets: number;
  }): Promise<TimelineProjectionTarget[]> {
    this.requests.push(input);
    return this.targets.slice();
  }
}

class FakeProjector implements DomainTimelineProjectionPort {
  commands: ProjectDomainEventCommand[] = [];
  failScopeIds = new Set<string>();

  async projectDomainEvent(
    command: ProjectDomainEventCommand,
  ): Promise<ProjectDomainEventResult> {
    this.commands.push(command);
    if (this.failScopeIds.has(command.scopeId)) {
      throw new Error(`projection failed for ${command.scopeId}`);
    }
    return {
      event: {
        projectionId: `projection-${command.scopeId}`,
        conversationId: command.conversationId,
        scopeId: command.scopeId,
        sequence: 1,
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
  }
}

const eventBus = new InMemoryEventBus();
const routing = new FakeRouting();
routing.targets = [
  { conversationId: 'conv-1', scopeId: 'scope-1' },
  { conversationId: 'conv-2', scopeId: 'scope-2' },
];
const projector = new FakeProjector();
const consumer = await startDomainTimelineProjectionConsumer({
  eventBus,
  routing,
  timeline: projector,
  runtime: {
    now: () => '2026-09-17T21:00:01.000Z',
    maxTargets: 40,
  },
});

const domainEvent = buildCanonicalResourceChangeEvent({
  eventId: 'shipment-change-1001',
  sourceCore: 'commerce',
  resourceType: 'shipment',
  resourceId: 'shipment-1001',
  changeType: 'shipment.out_for_delivery',
  occurredAt: '2026-09-17T21:00:00.000Z',
});
const minimalJson = JSON.stringify(domainEvent).toLowerCase();
for (const forbidden of ['phone', 'email', 'address', 'customer_name', 'document_body']) {
  assert(!minimalJson.includes(forbidden), `Canonical change event must not require copied ${forbidden}.`);
}

await eventBus.publish(domainEvent);
assert(Number(routing.requests.length) === 1, 'Canonical change must perform one indexed reverse-routing lookup.');
assert(routing.requests[0]?.sourceCore === 'commerce', 'Routing lookup must use owning source Core.');
assert(routing.requests[0]?.resourceType === 'shipment', 'Routing lookup must use canonical resource type.');
assert(routing.requests[0]?.resourceId === 'shipment-1001', 'Routing lookup must use canonical resource ID.');
assert(routing.requests[0]?.maxTargets === 40, 'Consumer must apply configured relationship fan-out guardrail.');
assert(Number(projector.commands.length) === 2, 'One canonical resource change must project into each linked relationship Scope.');
assert(projector.commands[0]?.conversationId === 'conv-1', 'Owning domain event must not need Conversation ID; routing discovers it.');
assert(projector.commands[0]?.domainEventId === 'shipment-change-1001', 'Projection idempotency must reuse original Event Core identity.');
assert(projector.commands[0]?.eventType === 'shipment.out_for_delivery', 'Timeline must preserve semantic change type, not generic canonical.changed only.');
assert(projector.commands[0]?.projectedAt === '2026-09-17T21:00:01.000Z', 'One processing attempt must use stable projectedAt across targets.');

const commandsBeforeMalformed = projector.commands.length;
await eventBus.publish({
  id: 'malformed-change',
  type: 'canonical.changed',
  occurredAt: '2026-09-17T21:01:00.000Z',
  source: 'commerce',
  payload: { resourceType: 'shipment' },
});
assert(
  projector.commands.length === commandsBeforeMalformed,
  'Malformed canonical change event must be ignored rather than creating partial timeline references.',
);

routing.targets = [];
await eventBus.publish(buildCanonicalResourceChangeEvent({
  eventId: 'unlinked-change',
  sourceCore: 'commerce',
  resourceType: 'shipment',
  resourceId: 'shipment-unlinked',
  changeType: 'shipment.delivered',
  occurredAt: '2026-09-17T21:02:00.000Z',
}));
assert(projector.commands.length === commandsBeforeMalformed, 'Unlinked domain resources must not create Message timeline work.');

routing.targets = [
  { conversationId: 'conv-3', scopeId: 'scope-fail' },
  { conversationId: 'conv-4', scopeId: 'scope-ok' },
];
projector.failScopeIds.add('scope-fail');
let partialFailureThrown = false;
try {
  await eventBus.publish(buildCanonicalResourceChangeEvent({
    eventId: 'partial-change',
    sourceCore: 'commerce',
    resourceType: 'shipment',
    resourceId: 'shipment-partial',
    changeType: 'shipment.delivered',
    occurredAt: '2026-09-17T21:03:00.000Z',
  }));
} catch (error) {
  partialFailureThrown = true;
  assert(error instanceof Error, 'Partial projection failure must surface to queue/EventBus retry semantics.');
}
assert(partialFailureThrown, 'At least one failed target must fail the consumer attempt.');
const partialCommands = projector.commands.filter((command) => command.domainEventId === 'partial-change');
assert(partialCommands.length === 2, 'Consumer must attempt all linked targets even when one target fails.');
assert(partialCommands.some((command) => command.scopeId === 'scope-ok'), 'Healthy target must progress despite another target failure.');

await consumer.close();
const beforeClosePublish = projector.commands.length;
routing.targets = [{ conversationId: 'conv-5', scopeId: 'scope-5' }];
await eventBus.publish(buildCanonicalResourceChangeEvent({
  eventId: 'after-close',
  sourceCore: 'commerce',
  resourceType: 'shipment',
  resourceId: 'shipment-after-close',
  changeType: 'shipment.delivered',
  occurredAt: '2026-09-17T21:04:00.000Z',
}));
assert(projector.commands.length === beforeClosePublish, 'Closed projection consumer must stop processing Event Core changes.');

console.log('Message domain timeline routing tests passed.');
