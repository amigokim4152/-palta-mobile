import type {
  ActorRef,
  ConversationScope,
  Message,
  MessageAttachment,
  ParticipantState,
} from './contracts.js';
import type {
  LockedConversationState,
  MessagePersistencePort,
  MessagePersistenceTransaction,
} from './persistencePort.js';
import type { DatabasePort } from '../ports/databasePort.js';

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('Expected finite numeric database value.');
  return parsed;
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

function mapMessage(row: Record<string, unknown>): Message {
  const principalUserId = optionalString(row.sender_principal_user_id);
  const actionResourceType = optionalString(row.action_resource_type);
  const actionResourceId = optionalString(row.action_resource_id);
  const actionKey = optionalString(row.action_key);
  const actionContractVersion = optionalString(row.action_contract_version);
  const scopeId = optionalString(row.scope_id);
  const body = optionalString(row.body);
  const replyToMessageId = optionalString(row.reply_to_message_id);
  const editedAt = optionalString(row.edited_at);
  const deletedAt = optionalString(row.deleted_at);

  return {
    messageId: String(row.id),
    conversationId: String(row.conversation_id),
    ...(scopeId !== undefined ? { scopeId } : {}),
    clientMessageId: String(row.client_message_id),
    sender: {
      actorType: String(row.sender_actor_type) as ActorRef['actorType'],
      actorId: String(row.sender_actor_id),
      ...(principalUserId !== undefined ? { principalUserId } : {}),
    },
    sequence: asNumber(row.sequence),
    type: String(row.message_type) as Message['type'],
    ...(body !== undefined ? { body } : {}),
    ...(replyToMessageId !== undefined ? { replyToMessageId } : {}),
    ...(actionResourceType && actionResourceId && actionKey && actionContractVersion
      ? {
          actionRef: {
            resourceType: actionResourceType,
            resourceId: actionResourceId,
            action: actionKey,
            contractVersion: actionContractVersion,
          },
        }
      : {}),
    createdAt: String(row.created_at),
    ...(editedAt !== undefined ? { editedAt } : {}),
    ...(deletedAt !== undefined ? { deletedAt } : {}),
  };
}

function mapAttachment(row: Record<string, unknown>): MessageAttachment {
  const sizeBytes = optionalNumber(row.size_bytes);
  const durationMs = optionalNumber(row.duration_ms);
  return {
    attachmentId: String(row.id),
    messageId: String(row.message_id),
    assetId: String(row.asset_id),
    kind: String(row.attachment_kind) as MessageAttachment['kind'],
    mimeType: String(row.mime_type),
    ...(sizeBytes !== undefined ? { sizeBytes } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
  };
}

async function hydrateAttachments(
  db: DatabasePort,
  messages: Message[],
): Promise<Message[]> {
  if (messages.length === 0) return messages;
  const messageIds = messages.map((message) => message.messageId);
  const result = await db.query(
    `select id, message_id, asset_id, attachment_kind, mime_type,
            size_bytes, duration_ms
       from msg_attachment
      where message_id = any($1::uuid[])
      order by message_id, created_at, id`,
    [messageIds],
  );
  const grouped = new Map<string, MessageAttachment[]>();
  for (const row of result.rows) {
    const attachment = mapAttachment(row);
    const current = grouped.get(attachment.messageId) ?? [];
    current.push(attachment);
    grouped.set(attachment.messageId, current);
  }
  return messages.map((message) => {
    const attachments = grouped.get(message.messageId);
    return attachments && attachments.length > 0
      ? { ...message, attachments }
      : message;
  });
}

const PARTICIPANT_RETURNING = `conversation_id, actor_type, actor_id, principal_user_id,
  participant_role, joined_at, left_at,
  last_delivered_sequence, last_read_sequence, muted, archived`;

class PostgresMessageTransaction implements MessagePersistenceTransaction {
  constructor(private readonly db: DatabasePort) {}

  async findMessageByIdempotency(input: {
    conversationId: string;
    sender: ActorRef;
    clientMessageId: string;
  }): Promise<Message | null> {
    const result = await this.db.query(
      `select id, conversation_id, scope_id, sequence, client_message_id,
              sender_actor_type, sender_actor_id, sender_principal_user_id,
              message_type, body, reply_to_message_id,
              action_resource_type, action_resource_id, action_key,
              action_contract_version, created_at, edited_at, deleted_at
         from msg_message
        where conversation_id = $1
          and sender_actor_type = $2
          and sender_actor_id = $3
          and client_message_id = $4
        limit 1`,
      [
        input.conversationId,
        input.sender.actorType,
        input.sender.actorId,
        input.clientMessageId,
      ],
    );
    if (!result.rows[0]) return null;
    const hydrated = await hydrateAttachments(this.db, [mapMessage(result.rows[0])]);
    return hydrated[0] ?? null;
  }

  async lockConversation(
    conversationId: string,
  ): Promise<LockedConversationState | null> {
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

  async findParticipant(input: {
    conversationId: string;
    actor: ActorRef;
  }): Promise<ParticipantState | null> {
    const result = await this.db.query(
      `select ${PARTICIPANT_RETURNING}
         from msg_participant
        where conversation_id = $1
          and actor_type = $2
          and actor_id = $3
        limit 1`,
      [input.conversationId, input.actor.actorType, input.actor.actorId],
    );
    const row = result.rows[0];
    return row ? mapParticipant(row) : null;
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
    if (!row) return null;
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

  async insertMessage(message: Message): Promise<void> {
    await this.db.query(
      `insert into msg_message (
         id, conversation_id, scope_id, sequence, client_message_id,
         sender_actor_type, sender_actor_id, sender_principal_user_id,
         message_type, body, reply_to_message_id,
         action_resource_type, action_resource_id, action_key,
         action_contract_version, created_at, edited_at, deleted_at
       ) values (
         $1, $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14,
         $15, $16, $17, $18
       )`,
      [
        message.messageId,
        message.conversationId,
        message.scopeId ?? null,
        message.sequence,
        message.clientMessageId,
        message.sender.actorType,
        message.sender.actorId,
        message.sender.principalUserId ?? null,
        message.type,
        message.body ?? null,
        message.replyToMessageId ?? null,
        message.actionRef?.resourceType ?? null,
        message.actionRef?.resourceId ?? null,
        message.actionRef?.action ?? null,
        message.actionRef?.contractVersion ?? null,
        message.createdAt,
        message.editedAt ?? null,
        message.deletedAt ?? null,
      ],
    );
  }

  async insertAttachments(attachments: MessageAttachment[]): Promise<void> {
    for (const attachment of attachments) {
      await this.db.query(
        `insert into msg_attachment (
           id, message_id, asset_id, attachment_kind, mime_type,
           size_bytes, duration_ms
         ) values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          attachment.attachmentId,
          attachment.messageId,
          attachment.assetId,
          attachment.kind,
          attachment.mimeType,
          attachment.sizeBytes ?? null,
          attachment.durationMs ?? null,
        ],
      );
    }
  }

  async updateConversationSequence(input: {
    conversationId: string;
    lastSequence: number;
    lastActivityAt: string;
  }): Promise<void> {
    await this.db.query(
      `update msg_conversation
          set last_sequence = $2,
              last_activity_at = $3
        where id = $1`,
      [input.conversationId, input.lastSequence, input.lastActivityAt],
    );
  }

  async advanceRead(input: {
    conversationId: string;
    actor: ActorRef;
    throughSequence: number;
  }): Promise<ParticipantState | null> {
    const result = await this.db.query(
      `update msg_participant p
          set last_read_sequence = greatest(
                p.last_read_sequence,
                least($4::bigint, c.last_sequence)
              ),
              last_delivered_sequence = greatest(
                p.last_delivered_sequence,
                least($4::bigint, c.last_sequence)
              )
         from msg_conversation c
        where p.conversation_id = c.id
          and p.conversation_id = $1
          and p.actor_type = $2
          and p.actor_id = $3
          and p.left_at is null
      returning p.conversation_id, p.actor_type, p.actor_id, p.principal_user_id,
                p.participant_role, p.joined_at, p.left_at,
                p.last_delivered_sequence, p.last_read_sequence, p.muted, p.archived`,
      [
        input.conversationId,
        input.actor.actorType,
        input.actor.actorId,
        input.throughSequence,
      ],
    );
    const row = result.rows[0];
    return row ? mapParticipant(row) : null;
  }

  async insertOutbox(event: import('./contracts.js').OutboxEvent): Promise<void> {
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

export class PostgresMessagePersistence implements MessagePersistencePort {
  constructor(private readonly db: DatabasePort) {}

  async transaction<T>(
    run: (tx: MessagePersistenceTransaction) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction((tx) => run(new PostgresMessageTransaction(tx)));
  }

  async listAfter(input: {
    conversationId: string;
    afterSequence: number;
    limit: number;
  }): Promise<Message[]> {
    const result = await this.db.query(
      `select id, conversation_id, scope_id, sequence, client_message_id,
              sender_actor_type, sender_actor_id, sender_principal_user_id,
              message_type, body, reply_to_message_id,
              action_resource_type, action_resource_id, action_key,
              action_contract_version, created_at, edited_at, deleted_at
         from msg_message
        where conversation_id = $1
          and sequence > $2
        order by sequence asc
        limit $3`,
      [input.conversationId, input.afterSequence, input.limit],
    );
    return hydrateAttachments(this.db, result.rows.map(mapMessage));
  }
}
