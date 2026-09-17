import type { MessageActorAuthorizationPort } from './authorizationPort.js';
import { selfAuthorizesUserActor } from './authorizationPort.js';
import type {
  ActorRef,
  Message,
  OutboxEvent,
  ResourceRef,
} from './contracts.js';
import type { MessagePersistencePort } from './persistencePort.js';
import type {
  ConversationDomainEventProjection,
  TimelinePersistencePort,
} from './timelinePort.js';

export type ConversationTimelineEntry =
  | { kind: 'message'; sequence: number; message: Message }
  | {
      kind: 'domain_event';
      sequence: number;
      event: ConversationDomainEventProjection;
    };

export interface ConversationTimelinePage {
  items: ConversationTimelineEntry[];
  nextAfterSequence: number;
  hasMore: boolean;
}

export interface ConversationTimelineRuntime {
  nextProjectionId(): string;
  nextOutboxEventId(): string;
}

export interface ProjectDomainEventCommand {
  conversationId: string;
  scopeId: string;
  sourceCore: string;
  domainEventId: string;
  eventType: string;
  resource: ResourceRef;
  occurredAt: string;
  projectedAt: string;
}

export interface ProjectDomainEventResult {
  event: ConversationDomainEventProjection;
  outboxEvent?: OutboxEvent;
  replayed: boolean;
}

export class ConversationTimelineServiceError extends Error {
  constructor(
    readonly code:
      | 'INVALID_TIMELINE_REQUEST'
      | 'INVALID_CURSOR'
      | 'ACTOR_NOT_AUTHORIZED'
      | 'NOT_PARTICIPANT'
      | 'CONVERSATION_NOT_FOUND'
      | 'SCOPE_NOT_FOUND'
      | 'SCOPE_CONVERSATION_MISMATCH'
      | 'SCOPE_ARCHIVED'
      | 'RESOURCE_NOT_LINKED',
    message: string,
  ) {
    super(message);
    this.name = 'ConversationTimelineServiceError';
  }
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ConversationTimelineServiceError(
      'INVALID_TIMELINE_REQUEST',
      `${label} is required.`,
    );
  }
  return normalized;
}

export class ConversationTimelineService {
  constructor(
    private readonly timelinePersistence: TimelinePersistencePort,
    private readonly messagePersistence: MessagePersistencePort,
    private readonly actorAuthorization: MessageActorAuthorizationPort,
    private readonly runtime: ConversationTimelineRuntime,
  ) {}

  private async assertActorAuthority(
    principalUserId: string,
    actor: ActorRef,
  ): Promise<void> {
    if (selfAuthorizesUserActor(principalUserId, actor)) return;
    if (actor.actorType === 'user' || actor.principalUserId !== principalUserId) {
      throw new ConversationTimelineServiceError(
        'ACTOR_NOT_AUTHORIZED',
        'Authenticated principal cannot act as requested participant.',
      );
    }
    const allowed = await this.actorAuthorization.canActAs({ principalUserId, actor });
    if (!allowed) {
      throw new ConversationTimelineServiceError(
        'ACTOR_NOT_AUTHORIZED',
        'Authenticated principal cannot act as requested participant.',
      );
    }
  }

  /**
   * Trusted internal projection path. The resource must already be authorized and
   * linked to the Scope. No domain payload is copied into Message Core.
   */
  async projectDomainEvent(
    command: ProjectDomainEventCommand,
  ): Promise<ProjectDomainEventResult> {
    required(command.conversationId, 'conversationId');
    required(command.scopeId, 'scopeId');
    required(command.sourceCore, 'sourceCore');
    required(command.domainEventId, 'domainEventId');
    required(command.eventType, 'eventType');
    required(command.resource.resourceType, 'resource.resourceType');
    required(command.resource.resourceId, 'resource.resourceId');
    required(command.occurredAt, 'occurredAt');
    required(command.projectedAt, 'projectedAt');

    return this.timelinePersistence.transaction(async (tx) => {
      const conversation = await tx.lockConversation(command.conversationId);
      if (!conversation) {
        throw new ConversationTimelineServiceError(
          'CONVERSATION_NOT_FOUND',
          'Conversation does not exist.',
        );
      }

      const existing = await tx.findProjectionByIdempotency({
        conversationId: command.conversationId,
        sourceCore: command.sourceCore,
        domainEventId: command.domainEventId,
      });
      if (existing) return { event: existing, replayed: true };

      const scope = await tx.findScope(command.scopeId);
      if (!scope) {
        throw new ConversationTimelineServiceError('SCOPE_NOT_FOUND', 'Scope does not exist.');
      }
      if (scope.conversationId !== command.conversationId) {
        throw new ConversationTimelineServiceError(
          'SCOPE_CONVERSATION_MISMATCH',
          'Scope belongs to a different Conversation.',
        );
      }
      if (scope.state === 'archived') {
        throw new ConversationTimelineServiceError(
          'SCOPE_ARCHIVED',
          'Archived Scope cannot receive new timeline projections.',
        );
      }

      const linkedResource = await tx.findLinkedScopeResource({
        scopeId: command.scopeId,
        sourceCore: command.sourceCore,
        resourceType: command.resource.resourceType,
        resourceId: command.resource.resourceId,
      });
      if (!linkedResource) {
        throw new ConversationTimelineServiceError(
          'RESOURCE_NOT_LINKED',
          'Domain event resource is not authorized and linked to this Scope.',
        );
      }

      const sequence = conversation.lastSequence + 1;
      const event = await tx.insertDomainEvent({
        projectionId: this.runtime.nextProjectionId(),
        conversationId: command.conversationId,
        scopeId: command.scopeId,
        sequence,
        sourceCore: command.sourceCore,
        domainEventId: command.domainEventId,
        eventType: command.eventType,
        resourceType: command.resource.resourceType,
        resourceId: command.resource.resourceId,
        occurredAt: command.occurredAt,
        projectedAt: command.projectedAt,
      });

      const outboxEvent: OutboxEvent = {
        outboxEventId: this.runtime.nextOutboxEventId(),
        aggregateType: 'scope',
        aggregateId: command.scopeId,
        eventType: 'message.domain_event_projected',
        payload: {
          conversationId: command.conversationId,
          scopeId: command.scopeId,
          sequence,
          projectionId: event.projectionId,
          domainEventId: event.eventId,
          eventType: event.eventType,
          sourceCore: event.sourceCore,
          resourceType: event.resourceType,
          resourceId: event.resourceId,
        },
        createdAt: command.projectedAt,
      };

      await tx.updateConversationSequence({
        conversationId: command.conversationId,
        lastSequence: sequence,
        lastActivityAt: command.projectedAt,
      });
      await tx.insertOutbox(outboxEvent);

      return { event, outboxEvent, replayed: false };
    });
  }

  async listAfter(input: {
    principalUserId: string;
    conversationId: string;
    actor: ActorRef;
    afterSequence: number;
    limit?: number;
  }): Promise<ConversationTimelinePage> {
    await this.assertActorAuthority(input.principalUserId, input.actor);
    if (!Number.isInteger(input.afterSequence) || input.afterSequence < 0) {
      throw new ConversationTimelineServiceError(
        'INVALID_CURSOR',
        'afterSequence must be a non-negative integer.',
      );
    }
    const limit = Math.min(200, Math.max(1, input.limit ?? 50));

    await this.timelinePersistence.transaction(async (tx) => {
      const participant = await tx.findParticipant({
        conversationId: input.conversationId,
        actorType: input.actor.actorType,
        actorId: input.actor.actorId,
      });
      if (!participant || participant.leftAt !== undefined) {
        throw new ConversationTimelineServiceError(
          'NOT_PARTICIPANT',
          'Actor is not an active conversation participant.',
        );
      }
    });

    const fetchLimit = limit + 1;
    const [messages, domainEvents] = await Promise.all([
      this.messagePersistence.listAfter({
        conversationId: input.conversationId,
        afterSequence: input.afterSequence,
        limit: fetchLimit,
      }),
      this.timelinePersistence.listDomainEventsAfter({
        conversationId: input.conversationId,
        afterSequence: input.afterSequence,
        limit: fetchLimit,
      }),
    ]);

    const merged: ConversationTimelineEntry[] = [
      ...messages.map((message): ConversationTimelineEntry => ({
        kind: 'message',
        sequence: message.sequence,
        message,
      })),
      ...domainEvents.map((event): ConversationTimelineEntry => ({
        kind: 'domain_event',
        sequence: event.sequence,
        event,
      })),
    ].sort((a, b) => a.sequence - b.sequence);

    const hasMore = merged.length > limit;
    const items = merged.slice(0, limit);
    const nextAfterSequence = items.at(-1)?.sequence ?? input.afterSequence;
    return { items, nextAfterSequence, hasMore };
  }
}
