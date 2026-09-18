import type { HomeCandidate } from '../core/contracts.js';
import type { EventBusPort } from '../events/eventBusPort.js';
import {
  decideCommunityOutboxFailure,
  type CommunityOutboxFailureDecision,
} from './communityOutboxDelivery.js';
import {
  projectCommunitySchoolItemToHomeCandidate,
  projectCommunitySchoolItemToNotificationEvent,
  shouldPublishCommunityNotificationCandidate,
  type CommunitySchoolItemEvent,
} from './communityHomeProjection.js';

export type ClaimedCommunityOutboxRecord = {
  id: string;
  eventType: 'community.school_item.changed';
  aggregateId: string;
  occurredAt: string;
  attempts: number;
  payload: Record<string, unknown>;
};

export interface CommunityOutboxStore {
  claimSchoolItemBatch(input: {
    workerId: string;
    now: Date;
    limit: number;
  }): Promise<ClaimedCommunityOutboxRecord[]>;
  markPublished(input: {
    recordId: string;
    workerId: string;
    publishedAt: Date;
  }): Promise<void>;
  markFailure(input: {
    recordId: string;
    workerId: string;
    errorCode: string;
    decision: CommunityOutboxFailureDecision;
  }): Promise<void>;
}

/**
 * Hydrates only server-authorized recipients. Implementations must re-check current
 * membership/relationship state at dispatch time instead of trusting the original
 * outbox payload, because a school relationship may have ended after enqueue.
 */
export interface CommunitySchoolOutboxHydrator {
  hydrateRecipients(record: ClaimedCommunityOutboxRecord): Promise<CommunitySchoolItemEvent[]>;
}

export interface CommunityHomeCandidateSink {
  upsert(input: { userId: string; candidate: HomeCandidate }): Promise<void>;
}

export interface CommunityOutboxErrorClassifier {
  code(error: unknown): string;
  retryable(error: unknown): boolean;
}

export type CommunityOutboxProcessResult = {
  claimed: number;
  published: number;
  failed: number;
  homeCandidates: number;
  notificationCandidates: number;
};

export async function processCommunitySchoolOutbox(input: {
  workerId: string;
  now: Date;
  limit?: number;
  store: CommunityOutboxStore;
  hydrator: CommunitySchoolOutboxHydrator;
  homeSink: CommunityHomeCandidateSink;
  eventBus: EventBusPort;
  errors: CommunityOutboxErrorClassifier;
}): Promise<CommunityOutboxProcessResult> {
  const claimed = await input.store.claimSchoolItemBatch({
    workerId: input.workerId,
    now: input.now,
    limit: Math.max(1, Math.min(100, input.limit ?? 25)),
  });

  const result: CommunityOutboxProcessResult = {
    claimed: claimed.length,
    published: 0,
    failed: 0,
    homeCandidates: 0,
    notificationCandidates: 0,
  };

  for (const record of claimed) {
    try {
      const recipientEvents = await input.hydrator.hydrateRecipients(record);

      for (const recipientEvent of recipientEvents) {
        const candidate = projectCommunitySchoolItemToHomeCandidate(
          recipientEvent,
          input.now,
        );
        if (!candidate) continue;

        // The sink must upsert using candidate.id/dedupeKey so an expired worker lease
        // or replay cannot multiply Home cards.
        await input.homeSink.upsert({
          userId: recipientEvent.recipient.userId,
          candidate,
        });
        result.homeCandidates += 1;

        if (
          shouldPublishCommunityNotificationCandidate(recipientEvent, candidate)
        ) {
          const event = projectCommunitySchoolItemToNotificationEvent(
            recipientEvent,
            input.now,
          );
          if (event) {
            // EventBus consumers use event.dedupeKey to make replay safe.
            await input.eventBus.publish(event);
            result.notificationCandidates += 1;
          }
        }
      }

      await input.store.markPublished({
        recordId: record.id,
        workerId: input.workerId,
        publishedAt: input.now,
      });
      result.published += 1;
    } catch (error) {
      const decision = decideCommunityOutboxFailure({
        attemptsBeforeFailure: record.attempts,
        retryable: input.errors.retryable(error),
        now: input.now,
      });
      await input.store.markFailure({
        recordId: record.id,
        workerId: input.workerId,
        errorCode: input.errors.code(error),
        decision,
      });
      result.failed += 1;
    }
  }

  return result;
}
