import type { EventBusPort } from '../events/eventBusPort.js';
import { parseCanonicalResourceChangeEvent } from '../events/canonicalChangeContract.js';
import type { ConversationTimelineService } from './conversationTimelineService.js';
import type { TimelineRoutingPort } from './timelineRoutingPort.js';

export interface DomainTimelineProjectionRuntime {
  now(): string;
  maxTargets?: number;
}

export interface DomainTimelineProjectionConsumerSet {
  close(): Promise<void>;
}

export async function startDomainTimelineProjectionConsumer(input: {
  eventBus: EventBusPort;
  routing: TimelineRoutingPort;
  timeline: ConversationTimelineService;
  runtime: DomainTimelineProjectionRuntime;
}): Promise<DomainTimelineProjectionConsumerSet> {
  const maxTargets = Math.min(100, Math.max(1, Math.trunc(input.runtime.maxTargets ?? 100)));

  const unsubscribe = await input.eventBus.subscribe(
    ['canonical.changed'],
    async (event) => {
      const change = parseCanonicalResourceChangeEvent(event);
      if (!change) return;

      const targets = await input.routing.findTargetsForResource({
        sourceCore: change.sourceCore,
        resourceType: change.resourceType,
        resourceId: change.resourceId,
        maxTargets,
      });
      if (targets.length === 0) return;

      const projectedAt = input.runtime.now();
      const failures: string[] = [];
      for (const target of targets) {
        try {
          await input.timeline.projectDomainEvent({
            conversationId: target.conversationId,
            scopeId: target.scopeId,
            sourceCore: change.sourceCore,
            domainEventId: change.eventId,
            eventType: change.changeType,
            resource: {
              resourceType: change.resourceType,
              resourceId: change.resourceId,
            },
            occurredAt: change.occurredAt,
            projectedAt,
          });
        } catch (error) {
          failures.push(
            `${target.conversationId}/${target.scopeId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }

      if (failures.length > 0) {
        throw new Error(
          `Domain timeline projection failed for ${failures.length}/${targets.length} target(s): ${failures.join(' | ')}`,
        );
      }
    },
  );

  return {
    async close() {
      await unsubscribe();
    },
  };
}
