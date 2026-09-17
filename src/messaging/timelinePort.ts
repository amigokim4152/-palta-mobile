import type {
  ConversationScope,
  ConversationScopeResourceRef,
  OutboxEvent,
  ParticipantState,
} from './contracts.js';

export interface ConversationDomainEventProjection {
  projectionId: string;
  conversationId: string;
  scopeId: string;
  sequence: number;
  sourceCore: string;
  eventId: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
  projectedAt: string;
}

export interface TimelineDomainEventDraft {
  projectionId: string;
  conversationId: string;
  scopeId: string;
  sequence: number;
  sourceCore: string;
  domainEventId: string;
  eventType: string;
  resourceType: string;
  resourceId: string;
  occurredAt: string;
  projectedAt: string;
}

export interface TimelinePersistenceTransaction {
  lockConversation(conversationId: string): Promise<{
    conversationId: string;
    lastSequence: number;
    lastActivityAt: string;
  } | null>;

  findProjectionByIdempotency(input: {
    conversationId: string;
    sourceCore: string;
    domainEventId: string;
  }): Promise<ConversationDomainEventProjection | null>;

  findScope(scopeId: string): Promise<ConversationScope | null>;

  findLinkedScopeResource(input: {
    scopeId: string;
    sourceCore: string;
    resourceType: string;
    resourceId: string;
  }): Promise<ConversationScopeResourceRef | null>;

  findParticipant(input: {
    conversationId: string;
    actorType: string;
    actorId: string;
  }): Promise<ParticipantState | null>;

  insertDomainEvent(
    event: TimelineDomainEventDraft,
  ): Promise<ConversationDomainEventProjection>;

  updateConversationSequence(input: {
    conversationId: string;
    lastSequence: number;
    lastActivityAt: string;
  }): Promise<void>;

  insertOutbox(event: OutboxEvent): Promise<void>;
}

export interface TimelinePersistencePort {
  transaction<T>(
    run: (tx: TimelinePersistenceTransaction) => Promise<T>,
  ): Promise<T>;

  listDomainEventsAfter(input: {
    conversationId: string;
    afterSequence: number;
    limit: number;
  }): Promise<ConversationDomainEventProjection[]>;
}
