import type { EventBusPort, PaltaEvent, PaltaEventType } from '../src/events/eventBusPort.js';
import type { OutboxEvent } from '../src/messaging/contracts.js';
import {
  MessageOutboxDispatcher,
  type MessageOutboxDispatcherRuntime,
} from '../src/messaging/outboxDispatcher.js';
import type {
  ClaimedOutboxEvent,
  MessageOutboxDispatchPort,
} from '../src/messaging/outboxDispatchPort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeOutbox implements MessageOutboxDispatchPort {
  records: Array<OutboxEvent & {
    published: boolean;
    processingToken?: string;
    attempts: number;
    lastError?: string;
  }> = [];

  async claimBatch(input: {
    processingToken: string;
    now: string;
    staleBefore: string;
    limit: number;
  }): Promise<ClaimedOutboxEvent[]> {
    const claimed = this.records.filter((record) => !record.published && !record.processingToken).slice(0, input.limit);
    return claimed.map((record) => {
      record.processingToken = input.processingToken;
      record.attempts += 1;
      return {
        ...record,
        processingToken: input.processingToken,
        publishAttemptCount: record.attempts,
      };
    });
  }

  async markPublished(input: {
    outboxEventId: string;
    processingToken: string;
    publishedAt: string;
  }): Promise<boolean> {
    const record = this.records.find((item) => item.outboxEventId === input.outboxEventId);
    if (!record || record.published || record.processingToken !== input.processingToken) return false;
    record.published = true;
    delete record.processingToken;
    return true;
  }

  async markFailed(input: {
    outboxEventId: string;
    processingToken: string;
    error: string;
  }): Promise<boolean> {
    const record = this.records.find((item) => item.outboxEventId === input.outboxEventId);
    if (!record || record.published || record.processingToken !== input.processingToken) return false;
    delete record.processingToken;
    record.lastError = input.error;
    return true;
  }
}

class FakeEventBus implements EventBusPort {
  published: PaltaEvent[] = [];
  failIds = new Set<string>();

  async publish(event: PaltaEvent): Promise<void> {
    if (this.failIds.has(event.id)) throw new Error(`FAIL:${event.id}`);
    this.published.push(event);
  }

  async subscribe(
    _types: readonly PaltaEventType[],
    _handler: (event: PaltaEvent) => Promise<void> | void,
  ): Promise<() => void> {
    return () => {};
  }
}

let token = 0;
let clock = 0;
const runtime: MessageOutboxDispatcherRuntime = {
  nextProcessingToken: () => `00000000-0000-4000-8000-${String(++token).padStart(12, '0')}`,
  now: () => `2026-09-17T20:${String(clock++).padStart(2, '0')}:00.000Z`,
  staleBefore: () => '2026-09-17T19:00:00.000Z',
};

const outbox = new FakeOutbox();
outbox.records.push(
  {
    outboxEventId: 'outbox-message-1',
    aggregateType: 'message',
    aggregateId: 'message-1',
    eventType: 'message.created',
    payload: {
      conversationId: 'conv-1',
      scopeId: 'scope-1',
      sequence: 1,
      messageId: 'message-1',
    },
    createdAt: '2026-09-17T20:00:00.000Z',
    published: false,
    attempts: 0,
  },
  {
    outboxEventId: 'outbox-read-1',
    aggregateType: 'conversation',
    aggregateId: 'conv-1',
    eventType: 'participant.read_advanced',
    payload: {
      conversationId: 'conv-1',
      actorType: 'user',
      actorId: 'user-1',
      throughSequence: 1,
    },
    createdAt: '2026-09-17T20:01:00.000Z',
    published: false,
    attempts: 0,
  },
);
const eventBus = new FakeEventBus();
const dispatcher = new MessageOutboxDispatcher(outbox, eventBus, runtime);

const first = await dispatcher.runBatch(10);
assert(first.claimed === 2 && first.published === 2 && first.failed === 0, 'Dispatcher must publish supported claimed events.');
assert(eventBus.published.length === 2, 'Two EventBus events must be emitted.');
assert(eventBus.published[0]?.type === 'message.created', 'Message outbox event must map to message.created.');
assert(eventBus.published[1]?.type === 'message.read_advanced', 'Read outbox event must map to message.read_advanced.');
assert(eventBus.published[0]?.id === 'outbox-message-1', 'Outbox ID must be immutable EventBus event ID.');
assert(eventBus.published[0]?.dedupeKey === 'message-outbox:outbox-message-1', 'EventBus dedupe key must be stable by outbox ID.');
assert(!JSON.stringify(eventBus.published[0]).toLowerCase().includes('phone'), 'Routing event must not contain customer contact data.');

const empty = await dispatcher.runBatch(10);
assert(empty.claimed === 0 && empty.published === 0, 'Published events must not be claimed again.');

outbox.records.push({
  outboxEventId: 'outbox-retry-1',
  aggregateType: 'message',
  aggregateId: 'message-retry',
  eventType: 'message.created',
  payload: { conversationId: 'conv-2', sequence: 4, messageId: 'message-retry' },
  createdAt: '2026-09-17T20:02:00.000Z',
  published: false,
  attempts: 0,
});
eventBus.failIds.add('outbox-retry-1');
const failed = await dispatcher.runBatch(10);
assert(failed.failed === 1 && failed.published === 0, 'Publish failure must release event for retry.');
const retryRecord = outbox.records.find((item) => item.outboxEventId === 'outbox-retry-1');
assert(retryRecord?.published === false && retryRecord.processingToken === undefined, 'Failed event must be unleased and unpublished.');
assert(retryRecord?.attempts === 1, 'Failed publication must count an attempt.');
eventBus.failIds.delete('outbox-retry-1');
const retried = await dispatcher.runBatch(10);
assert(retried.published === 1, 'Released event must publish successfully on later run.');
assert(retryRecord?.attempts === 2, 'Retry must increment publication attempts.');

outbox.records.push({
  outboxEventId: 'outbox-unsupported-1',
  aggregateType: 'message',
  aggregateId: 'message-unsupported',
  eventType: 'message.unknown',
  payload: {},
  createdAt: '2026-09-17T20:03:00.000Z',
  published: false,
  attempts: 0,
});
const unsupported = await dispatcher.runBatch(10);
assert(unsupported.failed === 1, 'Unsupported outbox event must fail safely instead of disappearing.');
assert(!eventBus.published.some((event) => event.id === 'outbox-unsupported-1'), 'Unsupported event must not reach EventBus.');

console.log('Message outbox dispatch tests passed.');
