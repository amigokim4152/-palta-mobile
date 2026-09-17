import type { EventBusPort, PaltaEvent } from '../events/eventBusPort.js';
import { parseCareSignalEvent } from './careSignalContract.js';
import type { CareSignalApplyPort } from './careSignalApplyPort.js';
import type { CareSignalRoutingPort } from './careSignalRoutingPort.js';

export interface CareSignalConsumerRuntime {
  maxTargets?: number;
}

export interface CareSignalConsumerSet {
  close(): Promise<void>;
}

export async function startCareSignalConsumer(input: {
  eventBus: EventBusPort;
  routing: CareSignalRoutingPort;
  apply: CareSignalApplyPort;
  runtime?: CareSignalConsumerRuntime;
}): Promise<CareSignalConsumerSet> {
  const maxTargets = Math.min(
    100,
    Math.max(1, Math.trunc(input.runtime?.maxTargets ?? 100)),
  );

  const unsubscribe = await input.eventBus.subscribe(
    ['care.signal'],
    async (event) => {
      const signal = parseCareSignalEvent(event);
      if (!signal) return;

      const targets = await input.routing.findTargetsForResource({
        sourceCore: signal.sourceCore,
        resourceType: signal.resourceType,
        resourceId: signal.resourceId,
        maxTargets,
      });
      if (targets.length === 0) return;

      const failures: string[] = [];
      for (const target of targets) {
        try {
          const result = await input.apply.applySignal({
            careTrackId: target.careTrackId,
            sourceSignalEventId: signal.eventId,
            sourceCore: signal.sourceCore,
            careEvent: signal.careEvent,
            resourceType: signal.resourceType,
            resourceId: signal.resourceId,
            occurredAt: signal.occurredAt,
            ...(signal.sourceSequence !== undefined
              ? { sourceSequence: signal.sourceSequence }
              : {}),
            ...(signal.expectedAt !== undefined ? { expectedAt: signal.expectedAt } : {}),
            ...(signal.waitingForKey !== undefined
              ? { waitingForKey: signal.waitingForKey }
              : {}),
            ...(signal.resultRef !== undefined ? { resultRef: signal.resultRef } : {}),
            ...(signal.outcomeRef !== undefined ? { outcomeRef: signal.outcomeRef } : {}),
          });

          if (!result.changed) continue;

          const updatedEvent: PaltaEvent = {
            id: `${signal.eventId}:care:${target.careTrackId}:updated`,
            type: 'care.updated',
            occurredAt: signal.occurredAt,
            source: 'care-core',
            subjectRef: `care:${target.careTrackId}`,
            dedupeKey: `care-updated:${target.careTrackId}:${signal.eventId}`,
            payload: {
              careTrackId: target.careTrackId,
              sourceSignalEventId: signal.eventId,
              ...(result.state !== undefined ? { state: result.state } : {}),
            },
          };
          await input.eventBus.publish(updatedEvent);
        } catch (error) {
          failures.push(
            `${target.careTrackId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (failures.length > 0) {
        throw new Error(
          `Care signal application failed for ${failures.length}/${targets.length} target(s): ${failures.join(' | ')}`,
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
