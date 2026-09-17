import type { EventBusPort } from '../events/eventBusPort.js';
import type {
  CareHomePresentationPort,
  CareHomeSnapshotPort,
} from '../care/careHomeProjectionPort.js';
import { startCareHomeProjectionConsumer } from '../care/careHomeProjectionConsumer.js';
import type { CareSignalApplyPort } from '../care/careSignalApplyPort.js';
import type { CareSignalRoutingPort } from '../care/careSignalRoutingPort.js';
import { startCareSignalConsumer } from '../care/careSignalConsumer.js';
import type { HomeCandidateProjectionPort } from '../home/homeCandidateProjectionPort.js';
import type { RealtimeAdapter } from '../messaging/realtimeAdapter.js';
import { startMessageEventConsumers } from '../messaging/messageEventConsumers.js';
import type {
  DomainTimelineProjectionPort,
  DomainTimelineProjectionRuntime,
} from '../messaging/domainTimelineProjectionConsumer.js';
import { startDomainTimelineProjectionConsumer } from '../messaging/domainTimelineProjectionConsumer.js';
import type { TimelineRoutingPort } from '../messaging/timelineRoutingPort.js';

export interface PaltaCommunicationRuntimeDependencies {
  eventBus: EventBusPort;
  realtime: RealtimeAdapter;
  timelineRouting: TimelineRoutingPort;
  timelineProjection: DomainTimelineProjectionPort;
  careRouting: CareSignalRoutingPort;
  careApply: CareSignalApplyPort;
  careSnapshots: CareHomeSnapshotPort;
  carePresentation: CareHomePresentationPort;
  homeProjection: HomeCandidateProjectionPort;
}

export interface PaltaCommunicationRuntimeOptions {
  now(): string;
  maxTimelineTargets?: number;
  maxCareTargets?: number;
}

export interface PaltaCommunicationRuntime {
  close(): Promise<void>;
}

/**
 * Starts the provider-neutral communication/care projection graph.
 *
 * This composition root deliberately depends only on Palta ports. It does not
 * import Cloudflare, Supabase, Neon, APNs/FCM, R2 or any provider SDK. Concrete
 * adapters are selected by the hosting runtime and passed in here.
 */
export async function startPaltaCommunicationRuntime(input: {
  dependencies: PaltaCommunicationRuntimeDependencies;
  options: PaltaCommunicationRuntimeOptions;
}): Promise<PaltaCommunicationRuntime> {
  const { dependencies, options } = input;

  const messageConsumers = await startMessageEventConsumers({
    eventBus: dependencies.eventBus,
    realtime: dependencies.realtime,
  });

  let timelineConsumer: Awaited<ReturnType<typeof startDomainTimelineProjectionConsumer>> | undefined;
  let careSignalConsumer: Awaited<ReturnType<typeof startCareSignalConsumer>> | undefined;
  let careHomeConsumer: Awaited<ReturnType<typeof startCareHomeProjectionConsumer>> | undefined;

  try {
    const timelineRuntime: DomainTimelineProjectionRuntime = {
      now: options.now,
      ...(options.maxTimelineTargets !== undefined
        ? { maxTargets: options.maxTimelineTargets }
        : {}),
    };
    timelineConsumer = await startDomainTimelineProjectionConsumer({
      eventBus: dependencies.eventBus,
      routing: dependencies.timelineRouting,
      timeline: dependencies.timelineProjection,
      runtime: timelineRuntime,
    });

    careSignalConsumer = await startCareSignalConsumer({
      eventBus: dependencies.eventBus,
      routing: dependencies.careRouting,
      apply: dependencies.careApply,
      ...(options.maxCareTargets !== undefined
        ? { runtime: { maxTargets: options.maxCareTargets } }
        : {}),
    });

    careHomeConsumer = await startCareHomeProjectionConsumer({
      eventBus: dependencies.eventBus,
      snapshots: dependencies.careSnapshots,
      presentation: dependencies.carePresentation,
      sink: dependencies.homeProjection,
    });
  } catch (error) {
    if (careHomeConsumer) await careHomeConsumer.close();
    if (careSignalConsumer) await careSignalConsumer.close();
    if (timelineConsumer) await timelineConsumer.close();
    await messageConsumers.close();
    throw error;
  }

  return {
    async close() {
      // Close in reverse startup order so downstream projections stop before
      // their upstream event producers/subscribers.
      await careHomeConsumer?.close();
      await careSignalConsumer?.close();
      await timelineConsumer?.close();
      await messageConsumers.close();
    },
  };
}
