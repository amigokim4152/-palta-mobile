import type {
  OutboxDispatchCandidate,
  OutboxDispatchDestination,
  OutboxRepository,
} from '../persistence/outboxRepository.js';

export type OutboxQueueMessage = {
  outboxEventId: string;
};

export interface OutboxQueuePublisher {
  send(message: OutboxQueueMessage): Promise<void>;
}

export type OutboxQueuePublishers = Record<
  OutboxDispatchDestination,
  OutboxQueuePublisher
>;

export type OutboxDispatchReport = {
  discovered: number;
  published: number;
  failed: number;
  failures: Array<{
    eventId: string;
    destination: OutboxDispatchDestination;
    error: string;
  }>;
};

export function parseOutboxQueueMessage(value: unknown): OutboxQueueMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Outbox Queue message must be an object.');
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.outboxEventId !== 'string' || !candidate.outboxEventId.trim()) {
    throw new Error('Outbox Queue message requires outboxEventId.');
  }
  if (Object.keys(candidate).length !== 1) {
    throw new Error('Outbox Queue message may contain only outboxEventId.');
  }
  return { outboxEventId: candidate.outboxEventId };
}

async function publishCandidates(
  candidates: readonly OutboxDispatchCandidate[],
  publishers: OutboxQueuePublishers,
  report: OutboxDispatchReport,
): Promise<void> {
  for (const candidate of candidates) {
    try {
      await publishers[candidate.destination].send({
        outboxEventId: candidate.eventId,
      });
      report.published += 1;
    } catch (error) {
      report.failed += 1;
      report.failures.push({
        eventId: candidate.eventId,
        destination: candidate.destination,
        error: error instanceof Error ? error.message : 'unknown_queue_publish_error',
      });
    }
  }
}

/**
 * Scheduled recovery dispatcher.
 *
 * Read-only against the Outbox. It intentionally does not mark rows as sent or
 * processing because a Queue publish is not proof that the external side effect
 * ran. Duplicate publications are safe: consumers must acquire claimEvent().
 */
export async function dispatchDueOutbox(input: {
  repository: OutboxRepository;
  publishers: OutboxQueuePublishers;
  now: string;
  limitPerDestination: number;
}): Promise<OutboxDispatchReport> {
  const report: OutboxDispatchReport = {
    discovered: 0,
    published: 0,
    failed: 0,
    failures: [],
  };

  for (const destination of ['payment', 'fiscal'] as const) {
    const candidates = await input.repository.listDispatchCandidates({
      destination,
      now: input.now,
      limit: input.limitPerDestination,
    });
    report.discovered += candidates.length;
    await publishCandidates(candidates, input.publishers, report);
  }

  return report;
}
