import type { DatabasePort } from '../ports/databasePort.js';
import type {
  ActorRef,
  Conversation,
  MessageType,
} from './contracts.js';
import type {
  ConversationDirectoryPort,
  ConversationInboxItem,
  EnsureOneToOneConversationInput,
  EnsureOneToOneConversationResult,
  InboxMessagePreview,
} from './conversationDirectoryPort.js';

function actorSortKey(actor: ActorRef): string {
  return `${actor.actorType}\u0000${actor.actorId}`;
}

function canonicalPair(first: ActorRef, second: ActorRef): [ActorRef, ActorRef] {
  return actorSortKey(first) <= actorSortKey(second)
    ? [first, second]
    : [second, first];
}

function mapConversation(row: Record<string, unknown>): Conversation {
  return {
    conversationId: String(row.id),
    type: String(row.conversation_type) as Conversation['type'],
    lastSequence: Number(row.last_sequence),
    lastActivityAt: String(row.last_activity_at),
    createdAt: String(row.created_at),
  };
}

function parseActorArray(value: unknown): ActorRef[] {
  const decoded = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(decoded)) return [];
  return decoded.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const actorType = record.actorType;
    const actorId = record.actorId;
    if (typeof actorType !== 'string' || typeof actorId !== 'string') return [];
    return [{ actorType: actorType as ActorRef['actorType'], actorId }];
  });
}

function mapPreview(row: Record<string, unknown>): InboxMessagePreview | undefined {
  if (!row.last_message_id) return undefined;
  const body = typeof row.last_message_body === 'string' && row.last_message_body.length > 0
    ? row.last_message_body
    : undefined;
  return {
    messageId: String(row.last_message_id),
    sequence: Number(row.last_message_sequence),
    type: String(row.last_message_type) as MessageType,
    ...(body !== undefined ? { body } : {}),
    createdAt: String(row.last_message_created_at),
  };
}

export class PostgresConversationDirectory implements ConversationDirectoryPort {
  constructor(private readonly db: DatabasePort) {}

  async ensureOneToOne(
    input: EnsureOneToOneConversationInput,
  ): Promise<EnsureOneToOneConversationResult> {
    const [actorA, actorB] = canonicalPair(input.first.actor, input.second.actor);

    return this.db.transaction(async (tx) => {
      await tx.query(
        `insert into msg_one_to_one_identity (
           actor_a_type, actor_a_id, actor_b_type, actor_b_id
         ) values ($1, $2, $3, $4)
         on conflict (actor_a_type, actor_a_id, actor_b_type, actor_b_id)
         do nothing`,
        [actorA.actorType, actorA.actorId, actorB.actorType, actorB.actorId],
      );

      const identityResult = await tx.query(
        `select conversation_id
           from msg_one_to_one_identity
          where actor_a_type = $1
            and actor_a_id = $2
            and actor_b_type = $3
            and actor_b_id = $4
          for update`,
        [actorA.actorType, actorA.actorId, actorB.actorType, actorB.actorId],
      );
      const identity = identityResult.rows[0];
      if (!identity) throw new Error('Conversation identity row was not created.');

      if (identity.conversation_id) {
        const existing = await tx.query(
          `select id, conversation_type, last_sequence, last_activity_at, created_at
             from msg_conversation
            where id = $1`,
          [identity.conversation_id],
        );
        const row = existing.rows[0];
        if (!row) throw new Error('Conversation identity references missing conversation.');
        return { conversation: mapConversation(row), created: false };
      }

      await tx.query(
        `insert into msg_conversation (
           id, conversation_type, last_sequence, last_activity_at, created_at
         ) values ($1, $2, 0, $3, $3)`,
        [input.conversationId, input.type, input.createdAt],
      );

      for (const participant of [input.first, input.second]) {
        await tx.query(
          `insert into msg_participant (
             conversation_id, actor_type, actor_id, principal_user_id,
             participant_role, joined_at,
             last_delivered_sequence, last_read_sequence, muted, archived
           ) values ($1, $2, $3, $4, $5, $6, 0, 0, false, false)`,
          [
            input.conversationId,
            participant.actor.actorType,
            participant.actor.actorId,
            participant.actor.principalUserId ?? null,
            participant.role,
            input.createdAt,
          ],
        );
      }

      await tx.query(
        `update msg_one_to_one_identity
            set conversation_id = $5
          where actor_a_type = $1
            and actor_a_id = $2
            and actor_b_type = $3
            and actor_b_id = $4`,
        [
          actorA.actorType,
          actorA.actorId,
          actorB.actorType,
          actorB.actorId,
          input.conversationId,
        ],
      );

      return {
        conversation: {
          conversationId: input.conversationId,
          type: input.type,
          lastSequence: 0,
          lastActivityAt: input.createdAt,
          createdAt: input.createdAt,
        },
        created: true,
      };
    });
  }

  async listForActor(input: {
    actor: ActorRef;
    cursor?: { lastActivityAt: string; conversationId: string };
    limit: number;
  }): Promise<ConversationInboxItem[]> {
    const cursorActivity = input.cursor?.lastActivityAt ?? null;
    const cursorConversation = input.cursor?.conversationId ?? null;
    const result = await this.db.query(
      `select
         c.id,
         c.conversation_type,
         c.last_sequence,
         c.last_activity_at,
         c.created_at,
         greatest(c.last_sequence - p.last_read_sequence, 0) as unread_count,
         coalesce(
           jsonb_agg(
             distinct jsonb_build_object(
               'actorType', cp.actor_type,
               'actorId', cp.actor_id
             )
           ) filter (where cp.actor_id is not null),
           '[]'::jsonb
         ) as counterpart_actors,
         lm.id as last_message_id,
         lm.sequence as last_message_sequence,
         lm.message_type as last_message_type,
         lm.body as last_message_body,
         lm.created_at as last_message_created_at
       from msg_participant p
       join msg_conversation c on c.id = p.conversation_id
       left join msg_participant cp
         on cp.conversation_id = c.id
        and not (cp.actor_type = p.actor_type and cp.actor_id = p.actor_id)
        and cp.left_at is null
       left join lateral (
         select id, sequence, message_type, left(body, 240) as body, created_at
           from msg_message
          where conversation_id = c.id
            and deleted_at is null
          order by sequence desc
          limit 1
       ) lm on true
      where p.actor_type = $1
        and p.actor_id = $2
        and p.left_at is null
        and (
          $3::timestamptz is null
          or c.last_activity_at < $3::timestamptz
          or (c.last_activity_at = $3::timestamptz and c.id < $4::uuid)
        )
      group by c.id, p.last_read_sequence,
               lm.id, lm.sequence, lm.message_type, lm.body, lm.created_at
      order by c.last_activity_at desc, c.id desc
      limit $5`,
      [input.actor.actorType, input.actor.actorId, cursorActivity, cursorConversation, input.limit],
    );

    return result.rows.map((row) => {
      const preview = mapPreview(row);
      return {
        conversation: mapConversation(row),
        counterpartActors: parseActorArray(row.counterpart_actors),
        unreadCount: Math.max(0, Number(row.unread_count) || 0),
        ...(preview !== undefined ? { lastMessage: preview } : {}),
      };
    });
  }
}
