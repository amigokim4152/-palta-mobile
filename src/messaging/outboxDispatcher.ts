import type { EventBusPort, PaltaEvent, PaltaEventType } from '../events/eventBusPort.js';
import type { ClaimedOutboxEvent, MessageOutboxDispatchPort } from './outboxDispatchPort.js';

export interface MessageOutboxDispatcherRuntime {
  nextProcessingToken(): string;
  now(): string;
  staleBefore(nowIso: string): string;
}

export interface MessageOutboxDispatchResult {
  claimed: number;
  published: number;
  failed: number;
  lostLease: number;
}

function eventTypeFor(outbox: ClaimedOutboxEvent): PaltaEventType | null {
  if (outbox.eventType === 'message.created') return 'message.created';
  if (outbox.eventType === 'participant.read_advanced') return 'message.read_advanced';
  if (outbox.eventType === 'message.domain_event_projected') {
    return 'message.domain_event_projected';
  }
  return null;
}

function toPaltaEvent(outbox: ClaimedOutboxEvent): PaltaEvent | null {
  const type = eventTypeFor(outbox);
  if (!type) return null;
  const conversationId = typeof outbox.payload?.conversationId === 'string'
    ? outbox.payload.conversationId
    : undefined;
  return {
    id: outbox.outboxEventId,
    type,
    occurredAt: outbox.createdAt,
    source: 'message-core',
    ...(conversationId !== undefined
      ? { subjectRef: `conversation:${conversationId}` }
      : {}),
    dedupeKey: `message-outbox:${outbox.outboxEventId}`,
    payload: { ...(outbox.payload ?? {}) },
  };
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

export class MessageOutboxDispatcher {
  constructor(
    private readonly outbox: MessageOutboxDispatchPort,
    private readonly eventBus: EventBusPort,
    private readonly runtime: MessageOutboxDispatcherRuntime,
  ) {}

  async runBatch(limit = 50): Promise<MessageOutboxDispatchResult> {
    const now = this.runtime.now();
    const processingToken = this.runtime.nextProcessingToken();
    const claimed = await this.outbox.claimBatch({
      processingToken,
      now,
      staleBefore: this.runtime.staleBefore(now),
      limit: Math.min(200, Math.max(1, Math.trunc(limit))),
    });

    const result: MessageOutboxDispatchResult = {
      claimed: claimed.length,
      published: 0,
      failed: 0,
      lostLease: 0,
    };

    for (const item of claimed) {
      const event = toPaltaEvent(item);
      if (!event) {
        const released = await this.outbox.markFailed({
          outboxEventId: item.outboxEventId,
          processingToken: item.processingToken,
          error: `Unsupported Message outbox event type: ${item.eventType}`,
        });
        if (released) result.failed += 1;
        else result.lostLease += 1;
        continue;
      }

      try {
        await this.eventBus.publish(event);
        const marked = await this.outbox.markPublished({
          outboxEventId: item.outboxEventId,
          processingToken: item.processingToken,
          publishedAt: this.runtime.now(),
        });
        if (marked) result.published += 1;
        else result.lostLease += 1;
      } catch (error) {
        const released = await this.outbox.markFailed({
          outboxEventId: item.outboxEventId,
          processingToken: item.processingToken,
          error: errorText(error),
        });
        if (released) result.failed += 1;
        else result.lostLease += 1;
      }
    }

    return result;
  }
}

export function defaultMessageOutboxDispatcherRuntime(input: {
  nextProcessingToken: () => string;
  leaseMs?: number;
}): MessageOutboxDispatcherRuntime {
  const leaseMs = Math.max(30_000, input.leaseMs ?? 5 * 60_000);
  return {
    nextProcessingToken: input.nextProcessingToken,
    now: () => new Date().toISOString(),
    staleBefore: (nowIso) =>
      new Date(new Date(nowIso).getTime() - leaseMs).toISOString(),
  };
}
