import {
  CommunityApiService,
  type CommunityAuthorizationPort,
  type CommunityRepository,
  type CommunityRepositoryTransaction,
} from '../infra/api/communityBoundary.js';
import { handleCommunityRequest } from '../infra/api/communityHttp.js';
import {
  PaltaApiIdentityResolver,
  SupabaseBearerSessionVerifier,
  type BearerSessionVerifier,
  type PaltaIdentityStore,
} from '../infra/api/paltaIdentityResolver.js';
import { SupabaseCommunityAuthorization } from '../infra/api/supabaseCommunityAuthorization.js';
import {
  transitionCommunityMembership,
  type CommunityMemberRole,
  type CommunityMembershipRecordState,
} from '../src/community/communityMembershipLifecycle.js';
import type { SchoolStructuredContentDraft } from '../src/community/schoolStructuredContent.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const ADMIN_ID = '00000000-0000-4000-8000-000000000101';
const GUARDIAN_ID = '00000000-0000-4000-8000-000000000102';
const SPACE_ID = '00000000-0000-4000-8000-000000000201';
const POST_ID = '00000000-0000-4000-8000-000000000401';
const GUARDIAN_MEMBERSHIP_ID = '00000000-0000-4000-8000-000000000302';

class TestVerifier implements BearerSessionVerifier {
  async verify(accessToken: string) {
    const authBrokerUserId = accessToken === 'admin-token'
      ? ADMIN_ID
      : accessToken === 'guardian-token'
        ? GUARDIAN_ID
        : null;
    return authBrokerUserId
      ? { authBrokerUserId, authSubject: authBrokerUserId }
      : null;
  }
}

class TestIdentityStore implements PaltaIdentityStore {
  active = new Set([ADMIN_ID, GUARDIAN_ID]);

  async accountExists(paltaUserId: string): Promise<boolean> {
    return this.active.has(paltaUserId);
  }

  async accountIsActive(paltaUserId: string): Promise<boolean> {
    return this.active.has(paltaUserId);
  }
}

type Membership = {
  id: string;
  userId: string;
  state: CommunityMembershipRecordState;
  roleKey: CommunityMemberRole;
};

type SchoolItem = SchoolStructuredContentDraft & { id: string };

type TestState = {
  memberships: Map<string, Membership>;
  schoolItems: SchoolItem[];
  reactions: Set<string>;
  receipts: Map<string, { operationKey: string; resourceId?: string }>;
  outboxEvents: string[];
};

function membershipFor(state: TestState, userId: string): Membership | undefined {
  return state.memberships.get(userId);
}

class TestRepository implements CommunityRepository {
  readonly state: TestState = {
    memberships: new Map([
      [ADMIN_ID, { id: '00000000-0000-4000-8000-000000000301', userId: ADMIN_ID, state: 'active', roleKey: 'admin' }],
    ]),
    schoolItems: [],
    reactions: new Set(),
    receipts: new Map(),
    outboxEvents: [],
  };

  async transaction<T>(work: (tx: CommunityRepositoryTransaction) => Promise<T>): Promise<T> {
    const state = this.state;
    const tx: CommunityRepositoryTransaction = {
      async getTab(userId) {
        return { active: membershipFor(state, userId)?.state === 'active' };
      },
      async getSpace(userId, spaceId) {
        if (spaceId !== SPACE_ID) return null;
        return {
          communitySpaceId: SPACE_ID,
          membershipState: membershipFor(state, userId)?.state ?? 'none',
        };
      },
      async getThread(userId, spaceId, postId) {
        if (spaceId !== SPACE_ID || postId !== POST_ID || membershipFor(state, userId)?.state !== 'active') return null;
        return { post: { postId: POST_ID }, comments: [] };
      },
      async getMembershipManagement(userId, spaceId) {
        if (spaceId !== SPACE_ID) return { currentRoleKey: 'member', pending: [], active: [] };
        return {
          currentRoleKey: membershipFor(state, userId)?.roleKey ?? 'member',
          pending: [...state.memberships.values()]
            .filter((item) => item.state === 'pending')
            .map((item) => ({ membershipId: item.id, memberLabel: 'Familia Golden', requestedRoleKey: 'guardian' })),
          active: [...state.memberships.values()]
            .filter((item) => item.state === 'active')
            .map((item) => ({ membershipId: item.id, roleKey: item.roleKey, isSelf: item.userId === userId })),
        };
      },
      async getSchoolItems(userId, spaceId) {
        if (spaceId !== SPACE_ID || membershipFor(state, userId)?.state !== 'active') return [];
        return state.schoolItems
          .filter((item) => !item.recipientUserId || item.recipientUserId === userId)
          .map((item) => ({
            ...item,
            status: state.reactions.has(`${userId}:${item.postId}:acknowledged`) ? 'acknowledged' : 'pending',
          }));
      },
      async joinSpace({ userId, spaceId }) {
        if (spaceId !== SPACE_ID) throw new Error('COMMUNITY_SPACE_NOT_FOUND');
        const current = membershipFor(state, userId);
        if (current?.state === 'active') return { state: 'active' as const };
        state.memberships.set(userId, {
          id: GUARDIAN_MEMBERSHIP_ID,
          userId,
          state: 'pending',
          roleKey: 'member',
        });
        return { state: 'pending' as const };
      },
      async setMembershipDecision({ actorUserId, spaceId, membershipId, decision, roleKey }) {
        if (spaceId !== SPACE_ID) throw new Error('COMMUNITY_SPACE_NOT_FOUND');
        const actor = membershipFor(state, actorUserId);
        const target = [...state.memberships.values()].find((item) => item.id === membershipId);
        if (!actor || !target) throw new Error('COMMUNITY_MEMBERSHIP_INVALID_TRANSITION');
        const transition = transitionCommunityMembership({
          currentState: target.state,
          currentRoleKey: target.roleKey,
          actorRoleKey: actor.roleKey,
          decision,
          ...(roleKey ? { assignedRoleKey: roleKey } : {}),
          nowIso: '2026-09-18T19:00:00-03:00',
        });
        target.state = transition.state;
        target.roleKey = transition.roleKey;
      },
      async createSchoolItem({ actorUserId, spaceId, draft }) {
        if (spaceId !== SPACE_ID || membershipFor(state, actorUserId)?.state !== 'active') {
          throw new Error('COMMUNITY_MEMBERSHIP_MANAGE_FORBIDDEN');
        }
        if (draft.recipientUserId && membershipFor(state, draft.recipientUserId)?.state !== 'active') {
          throw new Error('SCHOOL_ITEM_RECIPIENT_NOT_ACTIVE');
        }
        const id = '00000000-0000-4000-8000-000000000501';
        state.schoolItems.push({ id, ...draft });
        return { id };
      },
      async addComment() {},
      async setReaction({ userId, postId, reactionKey }) {
        state.reactions.add(`${userId}:${postId}:${reactionKey}`);
      },
      async findMutationReceipt({ userId, idempotencyKey }) {
        return state.receipts.get(`${userId}:${idempotencyKey}`) ?? null;
      },
      async saveMutationReceipt({ userId, idempotencyKey, operationKey, resourceId }) {
        state.receipts.set(
          `${userId}:${idempotencyKey}`,
          resourceId ? { operationKey, resourceId } : { operationKey },
        );
      },
      async appendOutbox({ eventType }) {
        state.outboxEvents.push(eventType);
      },
    };
    return work(tx);
  }
}

class TestAuthorization implements CommunityAuthorizationPort {
  constructor(private readonly repository: TestRepository) {}

  async assertCanReadSpace({ userId }: { userId: string; spaceId: string }) {
    const membership = membershipFor(this.repository.state, userId);
    if (!membership || !['active', 'pending'].includes(membership.state)) throw new Error('COMMUNITY_READ_FORBIDDEN');
  }
  async assertCanReadThread({ userId }: { userId: string; spaceId: string; postId: string }) {
    if (membershipFor(this.repository.state, userId)?.state !== 'active') throw new Error('COMMUNITY_READ_FORBIDDEN');
  }
  async assertCanJoin() {}
  async assertCanManageMemberships({ userId }: { userId: string; spaceId: string }) {
    const role = membershipFor(this.repository.state, userId)?.roleKey;
    if (role !== 'admin' && role !== 'leader') throw new Error('COMMUNITY_MEMBERSHIP_MANAGE_FORBIDDEN');
  }
  async assertCanComment({ userId }: { userId: string; spaceId: string; postId: string }) {
    if (membershipFor(this.repository.state, userId)?.state !== 'active') throw new Error('COMMUNITY_INTERACTION_FORBIDDEN');
  }
  async assertCanReact({ userId }: { userId: string; spaceId: string; postId: string; reactionKey: string }) {
    if (membershipFor(this.repository.state, userId)?.state !== 'active') throw new Error('COMMUNITY_INTERACTION_FORBIDDEN');
  }
}

async function request(
  service: CommunityApiService,
  resolver: PaltaApiIdentityResolver,
  input: { token?: string; path: string; method?: string; body?: unknown; idempotencyKey?: string },
): Promise<Response> {
  const headers = new Headers();
  if (input.token) headers.set('authorization', `Bearer ${input.token}`);
  if (input.body !== undefined) headers.set('content-type', 'application/json');
  if (input.idempotencyKey) headers.set('idempotency-key', input.idempotencyKey);
  const response = await handleCommunityRequest({
    request: new Request(`https://api.somospalta.cl${input.path}`, {
      method: input.method ?? 'GET',
      headers,
      ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
    }),
    service,
    identityResolver: resolver,
  });
  assert(response !== null, `Community route ${input.path} should be handled.`);
  return response;
}

const store = new TestIdentityStore();
const resolver = new PaltaApiIdentityResolver(new TestVerifier(), store);
const repository = new TestRepository();
const service = new CommunityApiService(repository, new TestAuthorization(repository));

const resolvedGuardian = await resolver.resolve(new Request('https://api.somospalta.cl/v1/community/tab', {
  headers: { authorization: 'Bearer guardian-token' },
}));
assert(resolvedGuardian?.paltaUserId === GUARDIAN_ID, 'Verified auth.users.id must remain the canonical Palta user id.');

store.active.delete(GUARDIAN_ID);
const inactiveGuardian = await resolver.resolve(new Request('https://api.somospalta.cl/v1/community/tab', {
  headers: { authorization: 'Bearer guardian-token' },
}));
assert(inactiveGuardian === null, 'Inactive canonical Palta account must fail closed.');
store.active.add(GUARDIAN_ID);

const sdkVerifier = new SupabaseBearerSessionVerifier({
  auth: {
    async getUser(token: string) {
      return token === 'sdk-valid'
        ? { data: { user: { id: GUARDIAN_ID } }, error: null }
        : { data: { user: null }, error: new Error('invalid token') };
    },
  },
});
assert((await sdkVerifier.verify('sdk-valid'))?.authBrokerUserId === GUARDIAN_ID, 'Supabase server verification must surface auth.users.id.');
assert(await sdkVerifier.verify('sdk-invalid') === null, 'Invalid Supabase access token must be rejected.');
assert(typeof SupabaseCommunityAuthorization === 'function', 'Concrete Supabase Community authorization adapter must compile into the server contract.');

const unauthenticatedJoin = await request(service, resolver, {
  path: `/v1/community/spaces/${SPACE_ID}/join`, method: 'POST',
});
assert(unauthenticatedJoin.status === 401, 'Community join must require an authenticated canonical account.');

const join = await request(service, resolver, {
  token: 'guardian-token',
  path: `/v1/community/spaces/${SPACE_ID}/join`,
  method: 'POST',
  idempotencyKey: 'golden-join-001',
});
assert(join.status === 204, 'Guardian join request should be accepted.');
assert(membershipFor(repository.state, GUARDIAN_ID)?.state === 'pending', 'Approval-required school join must remain pending.');

const pendingItems = await request(service, resolver, {
  token: 'guardian-token', path: `/v1/community/spaces/${SPACE_ID}/school-items`,
});
assert(pendingItems.status === 200, 'Pending relationship may read space shell without receiving private school content.');
const pendingPayload = await pendingItems.json() as { items: unknown[] };
assert(pendingPayload.items.length === 0, 'Pending relationship must not receive school items.');

const guardianApproveAttempt = await request(service, resolver, {
  token: 'guardian-token',
  path: `/v1/community/spaces/${SPACE_ID}/memberships/${GUARDIAN_MEMBERSHIP_ID}`,
  method: 'PATCH',
  body: { action: 'approve', roleKey: 'guardian' },
});
assert(guardianApproveAttempt.status === 403, 'Guardian must not approve their own membership request.');

const membershipManagement = await request(service, resolver, {
  token: 'admin-token', path: `/v1/community/spaces/${SPACE_ID}/memberships`,
});
assert(membershipManagement.status === 200, 'Admin should read pending membership queue.');
const membershipPayload = await membershipManagement.json() as { pending: Array<{ membershipId: string }> };
assert(membershipPayload.pending.some((item) => item.membershipId === GUARDIAN_MEMBERSHIP_ID), 'Admin queue should contain Golden guardian request.');

const approve = await request(service, resolver, {
  token: 'admin-token',
  path: `/v1/community/spaces/${SPACE_ID}/memberships/${GUARDIAN_MEMBERSHIP_ID}`,
  method: 'PATCH',
  body: { action: 'approve', roleKey: 'guardian' },
  idempotencyKey: 'golden-approve-001',
});
assert(approve.status === 204, 'Admin should approve guardian relationship.');
assert(membershipFor(repository.state, GUARDIAN_ID)?.state === 'active', 'Approved guardian must become active.');
assert(membershipFor(repository.state, GUARDIAN_ID)?.roleKey === 'guardian', 'Approval must assign guardian role.');

const createItem = await request(service, resolver, {
  token: 'admin-token',
  path: `/v1/community/spaces/${SPACE_ID}/school-items`,
  method: 'POST',
  idempotencyKey: 'golden-school-item-001',
  body: {
    postId: POST_ID,
    stage: 'child_notice',
    title: 'Preparar cuaderno',
    detail: 'Enviar cuaderno de ciencias mañana',
    actionRequired: true,
    sensitive: true,
    recipientUserId: GUARDIAN_ID,
    dueAt: '2026-09-19T08:00:00-03:00',
  },
});
assert(createItem.status === 204, 'Admin should create recipient-scoped child notice.');

const activeItems = await request(service, resolver, {
  token: 'guardian-token', path: `/v1/community/spaces/${SPACE_ID}/school-items`,
});
const activePayload = await activeItems.json() as { items: Array<{ status: string; recipientUserId?: string }> };
assert(activePayload.items.length === 1, 'Active guardian should receive their private school item.');
assert(activePayload.items[0]?.recipientUserId === GUARDIAN_ID, 'Private child notice must remain recipient scoped.');

const acknowledge = await request(service, resolver, {
  token: 'guardian-token',
  path: `/v1/community/spaces/${SPACE_ID}/posts/${POST_ID}/reactions`,
  method: 'POST',
  body: { reactionKey: 'acknowledged' },
  idempotencyKey: 'golden-ack-001',
});
assert(acknowledge.status === 204, 'Guardian should acknowledge the linked school post.');

const acknowledgedItems = await request(service, resolver, {
  token: 'guardian-token', path: `/v1/community/spaces/${SPACE_ID}/school-items`,
});
const acknowledgedPayload = await acknowledgedItems.json() as { items: Array<{ status: string }> };
assert(acknowledgedPayload.items[0]?.status === 'acknowledged', 'Acknowledgement should update school item projection.');

const endRelationship = await request(service, resolver, {
  token: 'admin-token',
  path: `/v1/community/spaces/${SPACE_ID}/memberships/${GUARDIAN_MEMBERSHIP_ID}`,
  method: 'PATCH',
  body: { action: 'end' },
  idempotencyKey: 'golden-end-001',
});
assert(endRelationship.status === 204, 'Admin should end the guardian relationship.');
assert(membershipFor(repository.state, GUARDIAN_ID)?.state === 'removed', 'Ended relationship should become removed.');

const afterEnd = await request(service, resolver, {
  token: 'guardian-token', path: `/v1/community/spaces/${SPACE_ID}/school-items`,
});
assert(afterEnd.status === 403, 'Ended school relationship must immediately lose private space access.');

assert(repository.state.outboxEvents.includes('community.membership.changed'), 'Membership changes must emit Community outbox events.');
assert(repository.state.outboxEvents.includes('community.school_item.changed'), 'School item creation must emit Community outbox event.');
assert(repository.state.outboxEvents.includes('community.reaction.changed'), 'Acknowledgement must emit Community reaction event.');

console.log('PASS: Community normalized-auth HTTP Golden Flow tests');
