import type { DatabasePort } from '../ports/databasePort.js';
import type {
  ActorRef,
  ConversationScope,
  ConversationScopeResourceRef,
  OutboxEvent,
  ParticipantState,
  ScopeAccessMode,
  ScopeResourceRelation,
} from './contracts.js';
import type {
  ConversationDomainEventProjection,
  TimelineDomainEventDraft,
  TimelinePersistencePort,
  TimelinePersistenceTransaction,
} from './timelinePort.js';

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Expected finite numeric database value.');
  return parsed;
}

function mapScope(row: Record<string, unknown>): ConversationScope {
  const label = optionalString(row.label);
  const resolvedAt = optionalString(row.resolved_at);
  const archivedAt = optionalString(row.archived_at);
  return {
    scopeId: String(row.id),
    conversationId: String(row.conversation_id),
    scopeType: String(row.scope_type),
    ...(label !== undefined ? { label } : {}),
    state: String(row.scope_state) as ConversationScope['state'],
    createdAt: String(row.created_at),
    ...(resolvedAt !== undefined ? { resolvedAt } : {}),
    ...(archivedAt !== undefined ? { archivedAt } : {}),
  };
}

function mapResource(row: Record<string, unknown>): ConversationScopeResourceRef {
  const snapshotVersion = optionalString(row.snapshot_version);
  const sourceCore = optionalString(row.source_core);
  const authorizationEvidenceRef = optionalString(row.authorization_evidence_ref);
  const accessMode = optionalString(row.access_mode);
  return {
    scopeId: String(row.scope_id),
    relation: String(row.relation) as ScopeResourceRelation,
    resourceType: String(row.resource_type),
    resourceId: String(row.resource_id),
    ...(snapshotVersion !== undefined ? { snapshotVersion } : {}),
    ...(sourceCore !== undefined ? { sourceCore } : {}),
    ...(authorizationEvidenceRef !== undefined
      ? { authorizationEvidenceRef }
      : {}),
    ...(accessMode !== undefined
      ? { accessMode: accessMode as ScopeAccessMode }
      : {}),
  };
}

function mapParticipant(row: Record<string, unknown>): ParticipantState {
  const principalUserId = optionalString(row.principal_user_id);
  const leftAt = optionalString(row.left_at);
  return {
    conversationId: String(row.conversation_id),
    actor: {
      actorType: String(row.actor_type) as ActorRef['actorType'],
      actorId: String(row.actor_id),
      ...(principalUserId !== undefined ? { principalUserId } : {}),
    },
    role: String(row.participant_role) as ParticipantState['role'],
    joinedAt: String(row.joined_at),
    ...(leftAt !== undefined ? { leftAt } : {}),
    lastDeliveredSequence: asNumber(row.last_delivered_sequence),
    lastReadSequence: asNumber(row.last_read_sequence),
    muted: Boolean(row.muted),
    archived: Boolean(row.archived),
  };
}

function mapProjection(row: Record<string, unknown>): ConversationDomainEventProjection {
  return {
    projectionId: String(row.id),
    conversationId: String(row.conversation_id),
    scopeId: String(row.scope_id),
    sequence: asNumber(row.sequence),
    sourceCore: String(row.source_core),
    eventId: String(row.domain_event_id),
    eventType: String(row.event_type),
    resourceType: String(row.resource_type),
    resourceId: String(row.resource_id),
    occurredAt: String(row.occurred_at),
    projectedAt: String(row.projected_at),
  };
}

const PROJECTION_COLUMNS = `id, conversation_id, scope_id, sequence,
  source_core, domain_event_id, event_type, resource_type, resource_id,
  occurred_at, projected_at`;

const PARTICIPANT_COLUMNS = `conversation_id, actor_type, actor_id, principal_user_id,
  participant_role, joined_at, left_at,
  last_delivered_sequence, last_read_sequence, muted, archived`;

class PostgresTimelineTransaction implements TimelinePersistenceTransaction {
  constructor(private readonly db: DatabasePort) {}

  async lockConversation(conversationId: string): Promise<{
    conversationId: string;
    lastSequence: number;
    lastActivityAt: string;
  } | null> {
    const result = await this.db.query(
      `select id, last_sequence, last_activity_at
         from msg_conversation
        where id = $1
        for update`,
      [conversationId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      conversationId: String(row.id),
      lastSequence: asNumber(row.last_sequence),
      lastActivityAt: String(row.last_activity_at),
    };
  }

  async findProjectionByIdempotency(input: {
    conversationId: string;
    sourceCore: string;
    domainEventId: string;
  }): Promise<ConversationDomainEventProjection | null> {
    const result = await this.db.query(
      `select ${PROJECTION_COLUMNS}
         from msg_timeline_domain_event
        where conversation_id = $1
          and source_core = $2
          and domain_event_id = $3
        limit 1`,
      [input.conversationId, input.sourceCore, input.domainEventId],
    );
    const row = result.rows[0];
    return row ? mapProjection(row) : null;
  }

  async findScope(scopeId: string): Promise<ConversationScope | null> {
    const result = await this.db.query(
      `select id, conversation_id, scope_type, label, scope_state,
              created_at, resolved_at, archived_at
         from msg_conversation_scope
        where id = $1
        limit 1`,
      [scopeId],
    );
    const row = result.rows[0];
    return row ? mapScope(row) : null;
  }

  async findLinkedScopeResource(input: {
    scopeId: string;
    sourceCore: string;
    resourceType: string;
    resourceId: string;
  }): Promise<ConversationScopeResourceRef | null> {
    const result = await this.db.query(
      `select scope_id, relation, resource_type, resource_id, snapshot_version,
              source_core, authorization_evidence_ref, access_mode
         from msg_scope_resource
        where scope_id = $1
          and source_core = $2
          and resource_type = $3
          and resource_id = $4
        limit 1`,
      [input.scopeId, input.sourceCore, input.resourceType, input.resourceId],
    );
    const row = result.rows[0];
    return row ? mapResource(row) : null;
  }

  async findParticipant(input: {
    conversationId: string;
    actorType: string;
    actorId: string;
  }): Promise<ParticipantState | null> {
    const result = await this.db.query(
      `select ${PARTICIPANT_COLUMNS}
         from msg_participant
        where conversation_id = $1
          and actor_type = $2
          and actor_id = $3
        limit 1`,
      [input.conversationId, input.actorType, input.actorId],
    );
    const row = result.rows[0];
    return row ? mapParticipant(row) : null;
  }

  async insertDomainEvent(
    event: TimelineDomainEventDraft,
  ): Promise<ConversationDomainEventProjection> {
    const result = await this.db.query(
      `insert into msg_timeline_domain_event (
         id, conversation_id, scope_id, sequence,
         source_core, domain_event_id, event_type,
         resource_type, resource_id, occurred_at, projected_at
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning ${PROJECTION_COLUMNS}`,
      [
        event.projectionId,
        event.conversationId,
        event.scopeId,
        event.sequence,
        event.sourceCore,
        event.domainEventId,
        event.eventType,
        event.resourceType,
        event.resourceId,
        event.occurredAt,
        event.projectedAt,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('Domain timeline event was not persisted.');
    return mapProjection(row);
  }

  async updateConversationSequence(input: {
    conversationId: string;
    lastSequence: number;
    lastActivityAt: string;
  }): Promise<void> {
    await this.db.query(
      `update msg_conversation
          set last_sequence = $2,
              last_activity_at = greatest(last_activity_at, $3::timestamptz)
        where id = $1`,
      [input.conversationId, input.lastSequence, input.lastActivityAt],
    );
  }

  async insertOutbox(event: OutboxEvent): Promise<void> {
    await this.db.query(
      `insert into msg_outbox (
         id, aggregate_type, aggregate_id, event_type, payload,
         created_at, published_at
       ) values ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        event.outboxEventId,
        event.aggregateType,
        event.aggregateId,
        event.eventType,
        JSON.stringify(event.payload ?? {}),
        event.createdAt,
        event.publishedAt ?? null,
      ],
    );
  }
}

export class PostgresTimelinePersistence implements TimelinePersistencePort {
  constructor(private readonly db: DatabasePort) {}

  async transaction<T>(
    run: (tx: TimelinePersistenceTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) => run(new PostgresTimelineTransaction(tx)));
  }

  async listDomainEventsAfter(input: {
    conversationId: string;
    afterSequence: number;
    limit: number;
  }): Promise<ConversationDomainEventProjection[]> {
    const result = await this.db.query(
      `select ${PROJECTION_COLUMNS}
         from msg_timeline_domain_event
        where conversation_id = $1
          and sequence > $2
        order by sequence asc
        limit $3`,
      [input.conversationId, input.afterSequence, input.limit],
    );
    return result.rows.map(mapProjection);
  }
}
