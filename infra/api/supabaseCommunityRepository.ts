import {
  CommunityRepository,
  CommunityRepositoryTransaction,
} from './communityBoundary';
import type {
  CommunityJoinPolicy,
  CommunityMemberRole,
  CommunityMembershipDecision,
  CommunityMembershipRecordState,
} from '../../src/community/communityMembershipLifecycle.js';
import {
  membershipStateForJoin,
  transitionCommunityMembership,
} from '../../src/community/communityMembershipLifecycle.js';

export type SqlQueryResult<Row = Record<string, unknown>> = { rows: Row[] };
export interface SqlTransaction { query<Row = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<SqlQueryResult<Row>>; }
export interface SqlPool { transaction<T>(work: (tx: SqlTransaction) => Promise<T>): Promise<T>; }
function oneOrNull<Row>(result: SqlQueryResult<Row>): Row | null { return result.rows[0] ?? null; }

class SupabaseCommunityTransaction implements CommunityRepositoryTransaction {
  constructor(private readonly tx: SqlTransaction) {}

  async getTab(userId: string): Promise<unknown> {
    const joined = await this.tx.query(
      `select s.id as "communitySpaceId", s.name, s.space_type as "spaceType",
              m.state as "membershipState"
         from community_space s
         join community_membership m on m.community_space_id = s.id
        where m.user_id = $1 and m.state in ('active','pending')
        order by m.updated_at desc`, [userId]);
    const feed = await this.tx.query(
      `select p.id as "postId", p.community_space_id as "communitySpaceId",
              s.name as "communityName", s.space_type as "spaceType", p.body,
              p.created_at as "createdAt", p.announcement, p.pinned
         from community_post p
         join community_space s on s.id = p.community_space_id
         join community_membership m on m.community_space_id = p.community_space_id
        where m.user_id = $1 and m.state = 'active'
          and (m.effective_to is null or m.effective_to > now())
          and p.content_state = 'published' and p.moderation_state = 'visible'
        order by p.pinned desc, p.created_at desc limit 50`, [userId]);
    return { myCommunities: joined.rows, discover: [], feed: feed.rows };
  }

  async getSpace(userId: string, spaceId: string): Promise<unknown | null> {
    return oneOrNull(await this.tx.query(
      `select s.id as "communitySpaceId", s.name, s.space_type as "spaceType", s.visibility,
              s.join_policy as "joinPolicy",
              case
                when m.state in ('active','pending') then m.state
                when m.state = 'invited' then 'invite_required'
                else 'none'
              end as "membershipState",
              m.role_key as "roleKey"
         from community_space s
         left join community_membership m on m.community_space_id = s.id and m.user_id = $1
        where s.id = $2`, [userId, spaceId]));
  }

  async getThread(userId: string, spaceId: string, postId: string): Promise<unknown | null> {
    const post = oneOrNull(await this.tx.query(
      `select p.id as "postId", p.community_space_id as "communitySpaceId", p.body,
              p.created_at as "createdAt", p.announcement, p.pinned
         from community_post p
         join community_membership m on m.community_space_id = p.community_space_id
        where p.community_space_id = $1 and p.id = $2 and m.user_id = $3 and m.state = 'active'
          and (m.effective_to is null or m.effective_to > now())
          and p.content_state = 'published' and p.moderation_state = 'visible'`,
      [spaceId, postId, userId]));
    if (!post) return null;
    const comments = await this.tx.query(
      `select c.id as "commentId", c.body, c.created_at as "createdAt"
         from community_comment c
        where c.post_id = $1 and c.content_state = 'published' and c.moderation_state = 'visible'
        order by c.created_at asc`, [postId]);
    return { post, comments: comments.rows };
  }

  async getMembershipManagement(userId: string, spaceId: string): Promise<unknown> {
    const actor = oneOrNull(await this.tx.query<{ roleKey: CommunityMemberRole }>(
      `select role_key as "roleKey"
         from community_membership
        where community_space_id = $1 and user_id = $2 and state = 'active'
          and (effective_to is null or effective_to > now())`,
      [spaceId, userId],
    ));
    const pending = await this.tx.query(
      `select id as "membershipId",
              coalesce(nullif(eligibility->>'displayLabel',''), 'Solicitud pendiente') as "memberLabel",
              coalesce(nullif(eligibility->>'requestedRoleKey',''), 'member') as "requestedRoleKey",
              requested_at as "requestedAt"
         from community_membership
        where community_space_id = $1 and state in ('pending','invited')
        order by requested_at asc nulls last, created_at asc`,
      [spaceId],
    );
    const active = await this.tx.query(
      `select id as "membershipId",
              coalesce(nullif(eligibility->>'displayLabel',''), 'Miembro de la comunidad') as "memberLabel",
              role_key as "roleKey", effective_from as "effectiveFrom",
              (user_id = $2) as "isSelf"
         from community_membership
        where community_space_id = $1 and state = 'active'
          and (effective_to is null or effective_to > now())
        order by effective_from asc nulls last, created_at asc`,
      [spaceId, userId],
    );
    return {
      currentRoleKey: actor?.roleKey ?? 'member',
      pending: pending.rows,
      active: active.rows,
    };
  }

  async joinSpace(input: { userId: string; spaceId: string }): Promise<{ state: 'active' | 'pending' }> {
    const space = oneOrNull(await this.tx.query<{ joinPolicy: CommunityJoinPolicy }>(
      `select join_policy as "joinPolicy" from community_space where id = $1`,
      [input.spaceId],
    ));
    if (!space) throw new Error('COMMUNITY_SPACE_NOT_FOUND');

    const current = oneOrNull(await this.tx.query<{ state: CommunityMembershipRecordState }>(
      `select state from community_membership where community_space_id = $1 and user_id = $2`,
      [input.spaceId, input.userId],
    ));
    const nextState = membershipStateForJoin({
      joinPolicy: space.joinPolicy,
      ...(current?.state ? { currentState: current.state } : {}),
    });

    if (current?.state === 'active' || current?.state === 'pending') return { state: nextState };

    await this.tx.query(
      `insert into community_membership
        (community_space_id,user_id,state,role_key,eligibility,requested_at,effective_from,effective_to,ended_at,end_reason,created_at,updated_at)
       values ($1,$2,$3,'member','{}'::jsonb,now(),case when $3 = 'active' then now() else null end,null,null,null,now(),now())
       on conflict (community_space_id,user_id) do update set
         state = excluded.state,
         role_key = case when community_membership.state = 'invited' then community_membership.role_key else 'member' end,
         requested_at = now(),
         decided_at = null,
         decided_by_user_id = null,
         effective_from = case when excluded.state = 'active' then now() else null end,
         effective_to = null,
         ended_at = null,
         end_reason = null,
         updated_at = now()`,
      [input.spaceId, input.userId, nextState],
    );
    return { state: nextState };
  }

  async setMembershipDecision(input: {
    actorUserId: string;
    spaceId: string;
    membershipId: string;
    decision: CommunityMembershipDecision;
    roleKey?: CommunityMemberRole;
  }): Promise<void> {
    const actor = oneOrNull(await this.tx.query<{ roleKey: CommunityMemberRole }>(
      `select role_key as "roleKey"
         from community_membership
        where community_space_id=$1 and user_id=$2 and state='active'
          and (effective_to is null or effective_to > now())`,
      [input.spaceId, input.actorUserId],
    ));
    if (!actor) throw new Error('COMMUNITY_MEMBERSHIP_MANAGE_FORBIDDEN');

    const target = oneOrNull(await this.tx.query<{
      state: CommunityMembershipRecordState;
      roleKey: CommunityMemberRole;
    }>(
      `select state, role_key as "roleKey"
         from community_membership
        where id=$1 and community_space_id=$2`,
      [input.membershipId, input.spaceId],
    ));
    if (!target) throw new Error('COMMUNITY_MEMBERSHIP_INVALID_TRANSITION');

    const nowIso = new Date().toISOString();
    const transition = transitionCommunityMembership({
      currentState: target.state,
      currentRoleKey: target.roleKey,
      actorRoleKey: actor.roleKey,
      decision: input.decision,
      ...(input.roleKey ? { assignedRoleKey: input.roleKey } : {}),
      nowIso,
    });

    const result = await this.tx.query(
      `update community_membership
          set state=$1, role_key=$2, decided_at=$3::timestamptz, decided_by_user_id=$4,
              effective_from=case when $1='active' then coalesce(effective_from,$3::timestamptz) else effective_from end,
              effective_to=case when $1 in ('removed','rejected') then $3::timestamptz else null end,
              ended_at=case when $1 in ('removed','rejected') then $3::timestamptz else null end,
              end_reason=case when $1='removed' then 'ended_by_manager' when $1='rejected' then 'rejected' else null end,
              updated_at=now()
        where id=$5 and community_space_id=$6 and state=$7
        returning id`,
      [transition.state, transition.roleKey, transition.decidedAt, input.actorUserId, input.membershipId, input.spaceId, target.state],
    );
    if (result.rows.length === 0) throw new Error('COMMUNITY_MEMBERSHIP_INVALID_TRANSITION');
  }

  async addComment(input: { userId: string; spaceId: string; postId: string; body: string }): Promise<void> {
    await this.tx.query(
      `insert into community_comment
        (community_space_id,post_id,author_user_id,body,content_state,moderation_state,created_at,updated_at)
       values ($1,$2,$3,$4,'published','visible',now(),now())`,
      [input.spaceId,input.postId,input.userId,input.body]);
  }

  async setReaction(input: { userId: string; spaceId: string; postId: string; reactionKey: string }): Promise<void> {
    await this.tx.query(
      `insert into community_reaction
        (community_space_id,actor_user_id,target_type,target_id,reaction_key,created_at)
       values ($1,$2,'post',$3,$4,now())
       on conflict (actor_user_id,target_type,target_id,reaction_key) do nothing`,
      [input.spaceId,input.userId,input.postId,input.reactionKey]);
  }

  async findMutationReceipt(input: { userId: string; idempotencyKey: string }): Promise<{ operationKey: string; resourceId?: string } | null> {
    return oneOrNull(await this.tx.query<{ operationKey: string; resourceId?: string }>(
      `select operation_key as "operationKey", resource_id::text as "resourceId"
         from community_mutation_receipt where user_id=$1 and idempotency_key=$2`,
      [input.userId,input.idempotencyKey]));
  }

  async saveMutationReceipt(input: { userId: string; idempotencyKey: string; operationKey: string; resourceId?: string }): Promise<void> {
    await this.tx.query(
      `insert into community_mutation_receipt (user_id,idempotency_key,operation_key,resource_id,created_at)
       values ($1,$2,$3,$4::uuid,now())`,
      [input.userId,input.idempotencyKey,input.operationKey,input.resourceId ?? null]);
  }

  async appendOutbox(input: { eventType: string; aggregateType: string; aggregateId: string; payload: Record<string, unknown> }): Promise<void> {
    await this.tx.query(
      `insert into community_outbox (event_type,aggregate_type,aggregate_id,payload,created_at)
       values ($1,$2,$3::uuid,$4::jsonb,now())`,
      [input.eventType,input.aggregateType,input.aggregateId,JSON.stringify(input.payload)]);
  }
}

export class SupabaseCommunityRepository implements CommunityRepository {
  constructor(private readonly pool: SqlPool) {}
  transaction<T>(work: (tx: CommunityRepositoryTransaction) => Promise<T>): Promise<T> {
    return this.pool.transaction((sqlTx) => work(new SupabaseCommunityTransaction(sqlTx)));
  }
}
