import type { CommunityAuthorizationPort } from './communityBoundary.js';
import type { CommunityMemberRole } from '../../src/community/communityMembershipLifecycle.js';
import { canManageCommunityMemberships } from '../../src/community/communityMembershipLifecycle.js';

export interface CommunityAuthorizationSqlTransaction {
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: Row[] }>;
}

export interface CommunityAuthorizationSqlPool {
  transaction<T>(
    work: (tx: CommunityAuthorizationSqlTransaction) => Promise<T>,
  ): Promise<T>;
}

function first<Row>(rows: Row[]): Row | null {
  return rows[0] ?? null;
}

async function activeMembership(
  tx: CommunityAuthorizationSqlTransaction,
  userId: string,
  spaceId: string,
): Promise<{ roleKey: CommunityMemberRole } | null> {
  const result = await tx.query<{ roleKey: CommunityMemberRole }>(
    `select role_key as "roleKey"
       from public.community_membership
      where community_space_id = $1::uuid
        and user_id = $2::uuid
        and state = 'active'
        and (effective_from is null or effective_from <= now())
        and (effective_to is null or effective_to > now())`,
    [spaceId, userId],
  );
  return first(result.rows);
}

async function assertVisiblePost(
  tx: CommunityAuthorizationSqlTransaction,
  userId: string,
  spaceId: string,
  postId: string,
): Promise<void> {
  const membership = await activeMembership(tx, userId, spaceId);
  if (!membership) throw new Error('COMMUNITY_INTERACTION_FORBIDDEN');

  const result = await tx.query<{ exists: boolean }>(
    `select exists(
       select 1
         from public.community_post
        where id = $1::uuid
          and community_space_id = $2::uuid
          and content_state = 'published'
          and moderation_state = 'visible'
     ) as exists`,
    [postId, spaceId],
  );
  if (result.rows[0]?.exists !== true) throw new Error('COMMUNITY_READ_FORBIDDEN');
}

/**
 * Server-side Community authorization for the normalized Supabase persistence path.
 * The mobile app never receives table grants; authorization is evaluated after the
 * bearer token has been resolved to an active canonical Palta account.
 */
export class SupabaseCommunityAuthorization implements CommunityAuthorizationPort {
  constructor(private readonly pool: CommunityAuthorizationSqlPool) {}

  async assertCanReadSpace(input: { userId: string; spaceId: string }): Promise<void> {
    await this.pool.transaction(async (tx) => {
      const result = await tx.query<{
        visibility: string;
        membershipState: string | null;
      }>(
        `select s.visibility,
                m.state as "membershipState"
           from public.community_space s
           left join public.community_membership m
             on m.community_space_id = s.id and m.user_id = $2::uuid
          where s.id = $1::uuid
            and (s.effective_from is null or s.effective_from <= now())
            and (s.effective_to is null or s.effective_to > now())`,
        [input.spaceId, input.userId],
      );
      const row = first(result.rows);
      if (!row) throw new Error('COMMUNITY_SPACE_NOT_FOUND');
      if (row.visibility === 'public') return;
      if (row.membershipState && ['active', 'pending', 'invited'].includes(row.membershipState)) return;
      throw new Error('COMMUNITY_READ_FORBIDDEN');
    });
  }

  async assertCanReadThread(input: { userId: string; spaceId: string; postId: string }): Promise<void> {
    await this.pool.transaction((tx) => assertVisiblePost(tx, input.userId, input.spaceId, input.postId));
  }

  async assertCanJoin(input: { userId: string; spaceId: string }): Promise<void> {
    await this.pool.transaction(async (tx) => {
      const result = await tx.query<{
        joinPolicy: string;
        membershipState: string | null;
      }>(
        `select s.join_policy as "joinPolicy",
                m.state as "membershipState"
           from public.community_space s
           left join public.community_membership m
             on m.community_space_id = s.id and m.user_id = $2::uuid
          where s.id = $1::uuid
            and (s.effective_from is null or s.effective_from <= now())
            and (s.effective_to is null or s.effective_to > now())`,
        [input.spaceId, input.userId],
      );
      const row = first(result.rows);
      if (!row) throw new Error('COMMUNITY_SPACE_NOT_FOUND');
      if (row.membershipState && ['suspended', 'removed'].includes(row.membershipState)) {
        throw new Error('COMMUNITY_MEMBERSHIP_BLOCKED');
      }
      if (row.joinPolicy === 'invite_only' && row.membershipState !== 'invited') {
        throw new Error('COMMUNITY_INVITE_REQUIRED');
      }
    });
  }

  async assertCanManageMemberships(input: { userId: string; spaceId: string }): Promise<void> {
    await this.pool.transaction(async (tx) => {
      const membership = await activeMembership(tx, input.userId, input.spaceId);
      if (!membership || !canManageCommunityMemberships(membership.roleKey)) {
        throw new Error('COMMUNITY_MEMBERSHIP_MANAGE_FORBIDDEN');
      }
    });
  }

  async assertCanComment(input: { userId: string; spaceId: string; postId: string }): Promise<void> {
    await this.pool.transaction((tx) => assertVisiblePost(tx, input.userId, input.spaceId, input.postId));
  }

  async assertCanReact(input: { userId: string; spaceId: string; postId: string; reactionKey: string }): Promise<void> {
    if (!input.reactionKey.trim() || input.reactionKey.length > 32) {
      throw new Error('COMMUNITY_INTERACTION_FORBIDDEN');
    }
    await this.pool.transaction((tx) => assertVisiblePost(tx, input.userId, input.spaceId, input.postId));
  }
}
