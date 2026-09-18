import type {
  CommunityMemberRole,
  CommunityMembershipDecision,
} from '../../src/community/communityMembershipLifecycle.js';

export type AuthenticatedPaltaIdentity = {
  paltaUserId: string;
  authSubject: string;
};

export type CommunityRequestContext = {
  identity: AuthenticatedPaltaIdentity;
  requestId: string;
  idempotencyKey?: string;
};

export type CommunityRepositoryTransaction = {
  getTab(userId: string): Promise<unknown>;
  getSpace(userId: string, spaceId: string): Promise<unknown | null>;
  getThread(userId: string, spaceId: string, postId: string): Promise<unknown | null>;
  getMembershipManagement(userId: string, spaceId: string): Promise<unknown>;
  joinSpace(input: { userId: string; spaceId: string }): Promise<{ state: 'active' | 'pending' }>;
  setMembershipDecision(input: {
    actorUserId: string;
    spaceId: string;
    membershipId: string;
    decision: CommunityMembershipDecision;
    roleKey?: CommunityMemberRole;
  }): Promise<void>;
  addComment(input: { userId: string; spaceId: string; postId: string; body: string }): Promise<void>;
  setReaction(input: { userId: string; spaceId: string; postId: string; reactionKey: string }): Promise<void>;
  findMutationReceipt(input: { userId: string; idempotencyKey: string }): Promise<{ operationKey: string; resourceId?: string } | null>;
  saveMutationReceipt(input: { userId: string; idempotencyKey: string; operationKey: string; resourceId?: string }): Promise<void>;
  appendOutbox(input: { eventType: string; aggregateType: string; aggregateId: string; payload: Record<string, unknown> }): Promise<void>;
};

export interface CommunityRepository {
  transaction<T>(work: (tx: CommunityRepositoryTransaction) => Promise<T>): Promise<T>;
}

export interface CommunityAuthorizationPort {
  assertCanReadSpace(input: { userId: string; spaceId: string }): Promise<void>;
  assertCanReadThread(input: { userId: string; spaceId: string; postId: string }): Promise<void>;
  assertCanJoin(input: { userId: string; spaceId: string }): Promise<void>;
  assertCanManageMemberships(input: { userId: string; spaceId: string }): Promise<void>;
  assertCanComment(input: { userId: string; spaceId: string; postId: string }): Promise<void>;
  assertCanReact(input: { userId: string; spaceId: string; postId: string; reactionKey: string }): Promise<void>;
}

export class CommunityApiService {
  constructor(
    private readonly repository: CommunityRepository,
    private readonly authorization: CommunityAuthorizationPort,
  ) {}

  getTab(context: CommunityRequestContext): Promise<unknown> {
    return this.repository.transaction((tx) => tx.getTab(context.identity.paltaUserId));
  }

  async getSpace(context: CommunityRequestContext, spaceId: string): Promise<unknown | null> {
    await this.authorization.assertCanReadSpace({ userId: context.identity.paltaUserId, spaceId });
    return this.repository.transaction((tx) => tx.getSpace(context.identity.paltaUserId, spaceId));
  }

  async getThread(context: CommunityRequestContext, spaceId: string, postId: string): Promise<unknown | null> {
    await this.authorization.assertCanReadThread({ userId: context.identity.paltaUserId, spaceId, postId });
    return this.repository.transaction((tx) => tx.getThread(context.identity.paltaUserId, spaceId, postId));
  }

  async getMembershipManagement(context: CommunityRequestContext, spaceId: string): Promise<unknown> {
    await this.authorization.assertCanManageMemberships({ userId: context.identity.paltaUserId, spaceId });
    return this.repository.transaction((tx) => tx.getMembershipManagement(context.identity.paltaUserId, spaceId));
  }

  async joinSpace(context: CommunityRequestContext, spaceId: string): Promise<void> {
    await this.authorization.assertCanJoin({ userId: context.identity.paltaUserId, spaceId });
    await this.mutate(context, 'community.join', spaceId, async (tx) => {
      const membership = await tx.joinSpace({ userId: context.identity.paltaUserId, spaceId });
      await tx.appendOutbox({
        eventType: 'community.membership.changed',
        aggregateType: 'community_space',
        aggregateId: spaceId,
        payload: {
          paltaUserId: context.identity.paltaUserId,
          spaceId,
          membershipState: membership.state,
        },
      });
    });
  }

  async setMembershipDecision(
    context: CommunityRequestContext,
    spaceId: string,
    membershipId: string,
    decision: CommunityMembershipDecision,
    roleKey?: CommunityMemberRole,
  ): Promise<void> {
    await this.authorization.assertCanManageMemberships({ userId: context.identity.paltaUserId, spaceId });
    await this.mutate(context, `community.membership.${decision}`, membershipId, async (tx) => {
      await tx.setMembershipDecision({
        actorUserId: context.identity.paltaUserId,
        spaceId,
        membershipId,
        decision,
        ...(roleKey ? { roleKey } : {}),
      });
      await tx.appendOutbox({
        eventType: 'community.membership.changed',
        aggregateType: 'community_space',
        aggregateId: spaceId,
        payload: {
          actorUserId: context.identity.paltaUserId,
          spaceId,
          membershipId,
          decision,
          ...(roleKey ? { roleKey } : {}),
        },
      });
    });
  }

  async addComment(context: CommunityRequestContext, spaceId: string, postId: string, body: string): Promise<void> {
    await this.authorization.assertCanComment({ userId: context.identity.paltaUserId, spaceId, postId });
    await this.mutate(context, 'community.comment.create', postId, async (tx) => {
      await tx.addComment({ userId: context.identity.paltaUserId, spaceId, postId, body });
      await tx.appendOutbox({
        eventType: 'community.comment.created',
        aggregateType: 'community_post',
        aggregateId: postId,
        payload: { paltaUserId: context.identity.paltaUserId, spaceId, postId },
      });
    });
  }

  async setReaction(context: CommunityRequestContext, spaceId: string, postId: string, reactionKey: string): Promise<void> {
    await this.authorization.assertCanReact({ userId: context.identity.paltaUserId, spaceId, postId, reactionKey });
    await this.mutate(context, 'community.reaction.set', postId, async (tx) => {
      await tx.setReaction({ userId: context.identity.paltaUserId, spaceId, postId, reactionKey });
      await tx.appendOutbox({
        eventType: 'community.reaction.changed',
        aggregateType: 'community_post',
        aggregateId: postId,
        payload: { paltaUserId: context.identity.paltaUserId, spaceId, postId, reactionKey },
      });
    });
  }

  private async mutate(
    context: CommunityRequestContext,
    operationKey: string,
    aggregateId: string,
    work: (tx: CommunityRepositoryTransaction) => Promise<void>,
  ): Promise<void> {
    await this.repository.transaction(async (tx) => {
      if (context.idempotencyKey) {
        const receipt = await tx.findMutationReceipt({
          userId: context.identity.paltaUserId,
          idempotencyKey: context.idempotencyKey,
        });
        if (receipt) {
          if (receipt.operationKey !== operationKey) {
            throw new Error('IDEMPOTENCY_KEY_OPERATION_CONFLICT');
          }
          return;
        }
      }

      await work(tx);

      if (context.idempotencyKey) {
        await tx.saveMutationReceipt({
          userId: context.identity.paltaUserId,
          idempotencyKey: context.idempotencyKey,
          operationKey,
          resourceId: aggregateId,
        });
      }
    });
  }
}
