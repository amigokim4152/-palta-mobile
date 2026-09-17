import type { MessageActorAuthorizationPort } from '../src/messaging/authorizationPort.js';
import type {
  ActorRef,
  ConversationScope,
  ConversationScopeResourceRef,
  Message,
  OutboxEvent,
  ParticipantState,
} from '../src/messaging/contracts.js';
import {
  ConversationTimelineService,
  ConversationTimelineServiceError,
} from '../src/messaging/conversationTimelineService.js';
import type {
  MessagePersistencePort,
  MessagePersistenceTransaction,
} from '../src/messaging/persistencePort.js';
import type {
  ConversationDomainEventProjection,
  TimelineDomainEventDraft,
  TimelinePersistencePort,
  TimelinePersistenceTransaction,
} from '../src/messaging/timelinePort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectCode(
  code: ConversationTimelineServiceError['code'],
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    assert(error instanceof ConversationTimelineServiceError, `Expected ${code}.`);
    assert(error.code === code, `Expected ${code}, received ${error.code}.`);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

const user: ActorRef = { actorType: 'user', actorId: 'user-1' };

class FakeTimelinePersistence implements TimelinePersistencePort {
  conversation = {
    conversationId: 'conv-1',
    lastSequence: 8,
    lastActivityAt: '2026-09-17T20:00:00.000Z',
  };
  scopes = new Map<string, ConversationScope>();
  resources = new Map<string, ConversationScopeResourceRef>();
  projections: ConversationDomainEventProjection[] = [];
  outbox: OutboxEvent[] = [];
  participants: ParticipantState[] = [];
  failOutbox = false;

  private resourceKey(input: {
    scopeId: string;
    sourceCore: string;
    resourceType: string;
    resourceId: string;
  }): string {
    return [input.scopeId, input.sourceCore, input.resourceType, input.resourceId].join('|');
  }

  linkResource(resource: ConversationScopeResourceRef): void {
    if (!resource.sourceCore) throw new Error('Fake linked resource requires sourceCore.');
    this.resources.set(
      this.resourceKey({
        scopeId: resource.scopeId,
        sourceCore: resource.sourceCore,
        resourceType: resource.resourceType,
        resourceId: resource.resourceId,
      }),
      resource,
    );
  }

  async transaction<T>(
    run: (tx: TimelinePersistenceTransaction) => Promise<T>,
  ): Promise<T> {
    const snapshot = {
      conversation: { ...this.conversation },
      projections: this.projections.slice(),
      outbox: this.outbox.slice(),
    };
    const tx: TimelinePersistenceTransaction = {
      lockConversation: async (conversationId) =>
        conversationId === this.conversation.conversationId
          ? { ...this.conversation }
          : null,
      findProjectionByIdempotency: async (input) =>
        this.projections.find(
          (event) =>
            event.conversationId === input.conversationId &&
            event.sourceCore === input.sourceCore &&
            event.eventId === input.domainEventId,
        ) ?? null,
      findScope: async (scopeId) => this.scopes.get(scopeId) ?? null,
      findLinkedScopeResource: async (input) =>
        this.resources.get(this.resourceKey(input)) ?? null,
      findParticipant: async (input) =>
        this.participants.find(
          (participant) =>
            participant.conversationId === input.conversationId &&
            participant.actor.actorType === input.actorType &&
            participant.actor.actorId === input.actorId,
        ) ?? null,
      insertDomainEvent: async (draft: TimelineDomainEventDraft) => {
        const event: ConversationDomainEventProjection = {
          projectionId: draft.projectionId,
          conversationId: draft.conversationId,
          scopeId: draft.scopeId,
          sequence: draft.sequence,
          sourceCore: draft.sourceCore,
          eventId: draft.domainEventId,
          eventType: draft.eventType,
          resourceType: draft.resourceType,
          resourceId: draft.resourceId,
          occurredAt: draft.occurredAt,
          projectedAt: draft.projectedAt,
        };
        this.projections.push(event);
        return event;
      },
      updateConversationSequence: async (input) => {
        this.conversation = {
          conversationId: input.conversationId,
          lastSequence: input.lastSequence,
          lastActivityAt:
            input.lastActivityAt > this.conversation.lastActivityAt
              ? input.lastActivityAt
              : this.conversation.lastActivityAt,
        };
      },
      insertOutbox: async (event) => {
        if (this.failOutbox) throw new Error('OUTBOX_FAILURE');
        this.outbox.push(event);
      },
    };

    try {
      return await run(tx);
    } catch (error) {
      this.conversation = snapshot.conversation;
      this.projections = snapshot.projections;
      this.outbox = snapshot.outbox;
      throw error;
    }
  }

  async listDomainEventsAfter(input: {
    conversationId: string;
    afterSequence: number;
    limit: number;
  }): Promise<ConversationDomainEventProjection[]> {
    return this.projections
      .filter(
        (event) =>
          event.conversationId === input.conversationId &&
          event.sequence > input.afterSequence,
      )
      .sort((a, b) => a.sequence - b.sequence)
      .slice(0, input.limit);
  }
}

class FakeMessagePersistence implements MessagePersistencePort {
  messages: Message[] = [];

  async transaction<T>(
    _run: (tx: MessagePersistenceTransaction) => Promise<T>,
  ): Promise<T> {
    throw new Error('FakeMessagePersistence.transaction is not used by timeline tests.');
  }

  async listAfter(input: {
    conversationId: string;
    afterSequence: number;
    limit: number;
  }): Promise<Message[]> {
    return this.messages
      .filter(
        (message) =>
          message.conversationId === input.conversationId &&
          message.sequence > input.afterSequence,
      )
      .sort((a, b) => a.sequence - b.sequence)
      .slice(0, input.limit);
  }
}

const timelinePersistence = new FakeTimelinePersistence();
timelinePersistence.scopes.set('scope-1', {
  scopeId: 'scope-1',
  conversationId: 'conv-1',
  scopeType: 'order',
  state: 'active',
  createdAt: '2026-09-17T19:00:00.000Z',
});
timelinePersistence.scopes.set('scope-archived', {
  scopeId: 'scope-archived',
  conversationId: 'conv-1',
  scopeType: 'order',
  state: 'archived',
  createdAt: '2026-09-17T18:00:00.000Z',
  archivedAt: '2026-09-17T19:30:00.000Z',
});
timelinePersistence.linkResource({
  scopeId: 'scope-1',
  relation: 'shipment',
  resourceType: 'shipment',
  resourceId: 'shipment-1001',
  sourceCore: 'commerce',
  authorizationEvidenceRef: 'evidence-shipment-1001',
  accessMode: 'view_status',
});
timelinePersistence.linkResource({
  scopeId: 'scope-archived',
  relation: 'shipment',
  resourceType: 'shipment',
  resourceId: 'shipment-archived',
  sourceCore: 'commerce',
  authorizationEvidenceRef: 'evidence-shipment-archived',
  accessMode: 'view_status',
});
timelinePersistence.participants.push({
  conversationId: 'conv-1',
  actor: user,
  role: 'customer',
  joinedAt: '2026-09-17T18:00:00.000Z',
  lastDeliveredSequence: 0,
  lastReadSequence: 0,
  muted: false,
  archived: false,
});

const messagePersistence = new FakeMessagePersistence();
const actorAuthorization: MessageActorAuthorizationPort = {
  canActAs: async () => false,
};
let projectionIds = 0;
let outboxIds = 0;
const service = new ConversationTimelineService(
  timelinePersistence,
  messagePersistence,
  actorAuthorization,
  {
    nextProjectionId: () => `projection-${++projectionIds}`,
    nextOutboxEventId: () => `outbox-domain-${++outboxIds}`,
  },
);

const first = await service.projectDomainEvent({
  conversationId: 'conv-1',
  scopeId: 'scope-1',
  sourceCore: 'commerce',
  domainEventId: 'shipment-event-1001-1',
  eventType: 'shipment.out_for_delivery',
  resource: { resourceType: 'shipment', resourceId: 'shipment-1001' },
  occurredAt: '2026-09-17T20:04:00.000Z',
  projectedAt: '2026-09-17T20:05:00.000Z',
});
assert(!first.replayed, 'First authorized domain event must create durable projection.');
assert(first.event.sequence === 9, 'Domain event must share the next canonical Conversation sequence.');
assert(timelinePersistence.conversation.lastSequence === 9, 'Projection must advance canonical Conversation sequence.');
assert(Number(timelinePersistence.outbox.length) === 1, 'Projection and outbox must commit together.');
assert(first.outboxEvent?.eventType === 'message.domain_event_projected', 'Projection must emit distinct outbox event type.');
const routingJson = JSON.stringify(first.outboxEvent).toLowerCase();
for (const forbidden of ['address', 'phone', 'email', 'body', 'bearer', 'token']) {
  assert(!routingJson.includes(forbidden), `Projection outbox must not copy ${forbidden}.`);
}

const replay = await service.projectDomainEvent({
  conversationId: 'conv-1',
  scopeId: 'scope-1',
  sourceCore: 'commerce',
  domainEventId: 'shipment-event-1001-1',
  eventType: 'shipment.out_for_delivery',
  resource: { resourceType: 'shipment', resourceId: 'shipment-1001' },
  occurredAt: '2026-09-17T20:04:00.000Z',
  projectedAt: '2026-09-17T20:06:00.000Z',
});
assert(replay.replayed, 'Duplicate owning-domain event must replay existing projection.');
assert(replay.event.projectionId === first.event.projectionId, 'Replay must preserve durable projection identity.');
assert(timelinePersistence.conversation.lastSequence === 9, 'Replay must not consume another Conversation sequence.');
assert(Number(timelinePersistence.outbox.length) === 1, 'Replay must not emit duplicate outbox work.');

await expectCode('IDEMPOTENCY_CONFLICT', () =>
  service.projectDomainEvent({
    conversationId: 'conv-1',
    scopeId: 'scope-1',
    sourceCore: 'commerce',
    domainEventId: 'shipment-event-1001-1',
    eventType: 'shipment.delivered',
    resource: { resourceType: 'shipment', resourceId: 'shipment-1001' },
    occurredAt: '2026-09-17T20:07:00.000Z',
    projectedAt: '2026-09-17T20:07:00.000Z',
  }),
);

await expectCode('RESOURCE_NOT_LINKED', () =>
  service.projectDomainEvent({
    conversationId: 'conv-1',
    scopeId: 'scope-1',
    sourceCore: 'commerce',
    domainEventId: 'foreign-shipment-event',
    eventType: 'shipment.delivered',
    resource: { resourceType: 'shipment', resourceId: 'shipment-foreign' },
    occurredAt: '2026-09-17T20:08:00.000Z',
    projectedAt: '2026-09-17T20:08:00.000Z',
  }),
);

await expectCode('SCOPE_ARCHIVED', () =>
  service.projectDomainEvent({
    conversationId: 'conv-1',
    scopeId: 'scope-archived',
    sourceCore: 'commerce',
    domainEventId: 'archived-event',
    eventType: 'shipment.delivered',
    resource: { resourceType: 'shipment', resourceId: 'shipment-archived' },
    occurredAt: '2026-09-17T20:09:00.000Z',
    projectedAt: '2026-09-17T20:09:00.000Z',
  }),
);

const beforeFailure = {
  sequence: timelinePersistence.conversation.lastSequence,
  projections: timelinePersistence.projections.length,
  outbox: timelinePersistence.outbox.length,
};
timelinePersistence.failOutbox = true;
try {
  await service.projectDomainEvent({
    conversationId: 'conv-1',
    scopeId: 'scope-1',
    sourceCore: 'commerce',
    domainEventId: 'shipment-event-rollback',
    eventType: 'shipment.delivered',
    resource: { resourceType: 'shipment', resourceId: 'shipment-1001' },
    occurredAt: '2026-09-17T20:10:00.000Z',
    projectedAt: '2026-09-17T20:10:00.000Z',
  });
  throw new Error('Expected outbox failure.');
} catch (error) {
  assert(error instanceof Error, 'Projection transaction failure must surface.');
}
timelinePersistence.failOutbox = false;
assert(timelinePersistence.conversation.lastSequence === beforeFailure.sequence, 'Outbox failure must roll back Conversation sequence.');
assert(Number(timelinePersistence.projections.length) === beforeFailure.projections, 'Outbox failure must roll back projection row.');
assert(Number(timelinePersistence.outbox.length) === beforeFailure.outbox, 'Outbox failure must not leave partial outbox state.');

messagePersistence.messages.push(
  {
    messageId: 'message-8',
    conversationId: 'conv-1',
    scopeId: 'scope-1',
    clientMessageId: 'message-client-8',
    sender: user,
    sequence: 8,
    type: 'text',
    body: '¿Ya salió mi pedido?',
    createdAt: '2026-09-17T20:00:00.000Z',
  },
  {
    messageId: 'message-10',
    conversationId: 'conv-1',
    scopeId: 'scope-1',
    clientMessageId: 'message-client-10',
    sender: { actorType: 'business', actorId: 'business-1' },
    sequence: 10,
    type: 'text',
    body: 'Sí, va en camino.',
    createdAt: '2026-09-17T20:11:00.000Z',
  },
);

const pageOne = await service.listAfter({
  principalUserId: 'user-1',
  conversationId: 'conv-1',
  actor: user,
  afterSequence: 7,
  limit: 2,
});
assert(pageOne.items.length === 2, 'Mixed timeline page must respect requested page size.');
assert(pageOne.items[0]?.kind === 'message' && pageOne.items[0].sequence === 8, 'Human message must remain a message timeline item.');
assert(pageOne.items[1]?.kind === 'domain_event' && pageOne.items[1].sequence === 9, 'Domain status change must remain a distinct timeline item.');
assert(pageOne.hasMore, 'Mixed timeline must advertise the later message.');
assert(pageOne.nextAfterSequence === 9, 'Mixed timeline cursor must advance by canonical shared sequence.');

const pageTwo = await service.listAfter({
  principalUserId: 'user-1',
  conversationId: 'conv-1',
  actor: user,
  afterSequence: pageOne.nextAfterSequence,
  limit: 2,
});
assert(pageTwo.items.length === 1, 'Second page must return remaining human message.');
assert(pageTwo.items[0]?.kind === 'message' && pageTwo.items[0].sequence === 10, 'Timeline reconnect must recover post-event message in canonical order.');
assert(!pageTwo.hasMore, 'Second page must finish the current timeline.');

console.log('Message timeline tests passed.');
