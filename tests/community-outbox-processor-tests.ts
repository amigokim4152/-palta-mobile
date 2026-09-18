import type { PaltaEvent } from '../src/events/eventBusPort.js';
import {
  processCommunitySchoolOutbox,
  type ClaimedCommunityOutboxRecord,
  type CommunityOutboxStore,
} from '../src/community/communityOutboxProcessor.js';
import type { CommunitySchoolItemEvent } from '../src/community/communityHomeProjection.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = new Date('2026-09-18T18:00:00-03:00');
const publishedIds: string[] = [];
const failures: Array<{ id: string; status: string }> = [];
const homeIds: string[] = [];
const events: PaltaEvent[] = [];

const claimed: ClaimedCommunityOutboxRecord[] = [
  {
    id: 'outbox-success',
    eventType: 'community.school_item.changed',
    aggregateId: 'item-supplies',
    occurredAt: '2026-09-18T17:55:00-03:00',
    attempts: 0,
    payload: { spaceId: 'school-1' },
  },
  {
    id: 'outbox-failure',
    eventType: 'community.school_item.changed',
    aggregateId: 'item-failure',
    occurredAt: '2026-09-18T17:56:00-03:00',
    attempts: 0,
    payload: { spaceId: 'school-1' },
  },
];

const store: CommunityOutboxStore = {
  async claimSchoolItemBatch({ limit }) {
    assert(limit === 25, 'Default outbox claim limit should be 25.');
    return claimed;
  },
  async markPublished({ recordId }) {
    publishedIds.push(recordId);
  },
  async markFailure({ recordId, decision }) {
    failures.push({ id: recordId, status: decision.status });
  },
};

function suppliesEvent(): CommunitySchoolItemEvent {
  return {
    outboxId: 'outbox-success',
    occurredAt: '2026-09-18T17:55:00-03:00',
    spaceId: 'school-1',
    spaceName: 'Colegio Palta',
    item: {
      id: 'item-supplies',
      postId: 'post-supplies',
      stage: 'supplies',
      title: 'Preparar materiales',
      detail: 'Cuaderno de ciencias',
      actionRequired: true,
      sensitive: false,
      dueAt: '2026-09-19T12:00:00-03:00',
    },
    recipient: {
      userId: 'guardian-1',
      membershipActive: true,
      relationshipActive: true,
      notificationsEnabled: true,
    },
  };
}

const result = await processCommunitySchoolOutbox({
  workerId: 'community-worker-test',
  now,
  store,
  hydrator: {
    async hydrateRecipients(record) {
      if (record.id === 'outbox-failure') throw new Error('temporary database problem');
      return [
        suppliesEvent(),
        {
          ...suppliesEvent(),
          recipient: {
            ...suppliesEvent().recipient,
            userId: 'guardian-ended',
            relationshipActive: false,
          },
        },
      ];
    },
  },
  homeSink: {
    async upsert({ candidate }) {
      homeIds.push(candidate.id);
    },
  },
  eventBus: {
    async publish(event) {
      events.push(event);
    },
    async subscribe() {
      return () => undefined;
    },
  },
  errors: {
    code() {
      return 'TEMPORARY_DATABASE_ERROR';
    },
    retryable() {
      return true;
    },
  },
});

assert(result.claimed === 2, 'Processor should report all claimed rows.');
assert(result.published === 1, 'Only the successful outbox row should be published.');
assert(result.failed === 1, 'A hydration failure should be tracked as failed.');
assert(result.homeCandidates === 1, 'Ended relationships must not produce Home candidates.');
assert(result.notificationCandidates === 1, 'Near required supplies should emit one notification candidate.');
assert(publishedIds.length === 1 && publishedIds[0] === 'outbox-success', 'Successful row should be marked published.');
assert(failures.length === 1 && failures[0]?.status === 'retryable_error', 'Transient errors should be scheduled for retry.');
assert(homeIds.length === 1, 'Home sink should receive only authorized candidate projections.');
assert(events.length === 1 && events[0]?.type === 'notification.candidate', 'Processor should reuse the shared notification.candidate event type.');
assert(events[0]?.dedupeKey, 'Published events must carry a dedupe key for replay safety.');

console.log('PASS: community outbox processor tests');
