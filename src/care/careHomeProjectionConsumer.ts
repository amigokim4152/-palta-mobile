import type { EventBusPort } from '../events/eventBusPort.js';
import type { HomeCandidateProjectionPort } from '../home/homeCandidateProjectionPort.js';
import { buildCareHomeCandidate } from './careHomeCandidatePolicy.js';
import type {
  CareHomePresentationPort,
  CareHomeSnapshotPort,
} from './careHomeProjectionPort.js';

function payloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

export interface CareHomeProjectionConsumerSet {
  close(): Promise<void>;
}

export async function startCareHomeProjectionConsumer(input: {
  eventBus: EventBusPort;
  snapshots: CareHomeSnapshotPort;
  presentation: CareHomePresentationPort;
  sink: HomeCandidateProjectionPort;
}): Promise<CareHomeProjectionConsumerSet> {
  const unsubscribe = await input.eventBus.subscribe(
    ['care.updated'],
    async (event) => {
      const payload = event.payload ?? {};
      const careTrackId = payloadString(payload, 'careTrackId');
      if (!careTrackId) return;

      const snapshot = await input.snapshots.load(careTrackId);
      if (!snapshot) return;

      const sourceSignalEventId = payloadString(payload, 'sourceSignalEventId');
      const presentation = await input.presentation.present({
        snapshot,
        ...(sourceSignalEventId !== undefined ? { sourceSignalEventId } : {}),
        occurredAt: event.occurredAt,
      });

      const dedupeKey = `care:${careTrackId}`;
      if (!presentation) {
        await input.sink.remove({ userId: snapshot.userId, dedupeKey });
        return;
      }

      const candidate = buildCareHomeCandidate(snapshot.track, presentation);
      if (!candidate) {
        await input.sink.remove({ userId: snapshot.userId, dedupeKey });
        return;
      }

      await input.sink.upsert({
        userId: snapshot.userId,
        candidate,
        careTrackId,
        ...(snapshot.subjectEntityId !== undefined
          ? { relatedEntityId: snapshot.subjectEntityId }
          : {}),
      });
    },
  );

  return {
    async close() {
      await unsubscribe();
    },
  };
}
