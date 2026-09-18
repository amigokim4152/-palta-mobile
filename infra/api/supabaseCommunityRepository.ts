import {
  CommunityRepository,
  CommunityRepositoryTransaction,
} from './communityBoundary';

export type SqlQueryResult<Row = Record<string, unknown>> = { rows: Row[] };

export interface SqlTransaction {
  query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<SqlQueryResult<Row>>;
}

export interface SqlPool {
  transaction<T>(work: (tx: SqlTransaction) => Promise<T>): Promise<T>;
}

function oneOrNull<Row>(result: SqlQueryResult<Row>): Row | null {
  return result.rows[0] ?? null;
}

class SupabaseCommunityTransaction implements CommunityRepositoryTransaction {
  constructor(private readonly tx: SqlTransaction) {}

  async getTab(userId: string): Promise<unknown> {
    const joined = await this.tx.query(
      `select s.community_space_id as "communitySpaceId", s.name, s.kind,
              m.state as "membershipState"
         from community_space s
         join community_membership m on m.community_space_id = s.community_space_id
        where m.user_id = $1 and m.state in ('active','pending')
        order by m.updated_at desc`,
      [userId],
    );
    const feed = await this.tx.query(
      `select p.post_id as "postId", p.community_space_id as "communitySpaceId",
              s.name as "communityName", s.kind, p.body,
              p.created_at as "createdAt", p.announcement, p.pinned
         from community_post p
         join community_space s on s.community_space_id = p.community_space_id
         join community_membership m on m.community_space_id = p.community_space_id
        where m.user_id = $1 and m.state = 'active'
          and p.content_state = 'published' and p.moderation_state = 'visible'
        order by p.pinned desc, p.created_at desc
        limit 50`,
      [userId],
    );
    return { myCommunities: joined.rows, discover: [], feed: feed.rows };
  }

  async getSpace(userId: string, spaceId: string): Promise<unknown | null> {
    return oneOrNull(await this.tx.query(
      `select s.community_space_id as "communitySpaceId", s.name, s.kind, s.visibility,
              coalesce(m.state, 'none') as "membershipState"
         from community_space s
         left join community_membership m
           on m.community_space_id = s.community_space_id and m.user_id = $1
        where s.community_space_id = $2`,
      [userId, spaceId],
    ));
  }

  async getThread(userId: string, spaceId: string, postId: string): Promise<unknown | null> {
    const post = oneOrNull(await this.tx.query(
      `select p.post_id as "postId", p.community_space_id as "communitySpaceId",
              p.body, p.created_at as "createdAt", p.announcement, p.pinned
         from community_post p
         join community_membership m on m.community_space_id = p.community_space_id
        where p.community_space_id = $1 and p.post_id = $2
          and m.user_id = $3 and m.state = 'active'
          and p.content_state = 'published' and p.moderation_state = 'visible'`,
      [spaceId, postId, userId],
    ));
    if (!post) return null;
    const comments = await this.tx.query(
      `select c.comment_id as "commentId", c.body, c.created_at as "createdAt"
         from community_comment c
        where c.post_id = $1 and c.content_state = 'published'
          and c.moderation_state = 'visible'
        order by c.created_at asc`,
      [postId],
    );
    return { post, comments: comments.rows };
  }

  async joinSpace(input: { userId: string; spaceId: string }): Promise<void> {
    await this.tx.query(
      `insert into community_membership
        (membership_id, community_space_id, user_id, state, eligibility, created_at, updated_at)
       values (gen_random_uuid(), $1, $2, 'active', '{}'::jsonb, now(), now())
       on conflict (community_space_id, user_id)
       do update set state = 'active', updated_at = now()`,
      [input.spaceId, input.userId],
    );
  }

  async addComment(input: { userId: string; spaceId: string; postId: string; body: string }): Promise<void> {
    await this.tx.query(
      `insert into community_comment
        (comment_id, community_space_id, post_id, author_user_id, body, content_state, moderation_state, created_at, updated_at)
       values (gen_random_uuid(), $1, $2, $3, $4, 'published', 'visible', now(), now())`,
      [input.spaceId, input.postId, input.userId, input.body],
    );
  }

  async setReaction(input: { userId: string; spaceId: string; postId: string; reactionKey: string }): Promise<void> {
    await this.tx.query(
      `insert into community_reaction
        (reaction_id, community_space_id, actor_user_id, target_type, target_id, reaction_key, created_at)
       values (gen_random_uuid(), $1, $2, 'post', $3, $4, now())
       on conflict (actor_user_id, target_type, target_id, reaction_key) do nothing`,
      [input.spaceId, input.userId, input.postId, input.reactionKey],
    );
  }

  async findMutationReceipt(input: { userId: string; idempotencyKey: string }): Promise<{ operationKey: string; resourceId?: string } | null> {
    return oneOrNull(await this.tx.query<{ operationKey: string; resourceId?: string }>(
      `select operation_key as "operationKey", resource_id as "resourceId"
         from community_mutation_receipt where user_id = $1 and idempotency_key = $2`,
      [input.userId, input.idempotencyKey],
    ));
  }

  async saveMutationReceipt(input: { userId: string; idempotencyKey: string; operationKey: string; resourceId?: string }): Promise<void> {
    await this.tx.query(
      `insert into community_mutation_receipt
        (user_id, idempotency_key, operation_key, resource_id, created_at)
       values ($1,$2,$3,$4,now())`,
      [input.userId, input.idempotencyKey, input.operationKey, input.resourceId ?? null],
    );
  }

  async appendOutbox(input: { eventType: string; aggregateType: string; aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    await this.tx.query(
      `insert into community_outbox
        (outbox_id, event_type, aggregate_type, aggregate_id, payload, created_at)
       values (gen_random_uuid(), $1,$2,$3,$4::jsonb,now())`,
      [input.eventType, input.aggregateType, input.aggregateId, JSON.stringify(input.payload)],
    );
  }
}

export class SupabaseCommunityRepository implements CommunityRepository {
  constructor(private readonly pool: SqlPool) {}
  transaction<T>(work: (tx: CommunityRepositoryTransaction) => Promise<T>): Promise<T> {
    return this.pool.transaction((sqlTx) => work(new SupabaseCommunityTransaction(sqlTx)));
  }
}
