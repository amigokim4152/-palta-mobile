import { CommunityApiService, CommunityRequestContext } from './communityBoundary';
import type {
  CommunityMemberRole,
  CommunityMembershipDecision,
} from '../../src/community/communityMembershipLifecycle.js';
import type { SchoolFlowStage } from '../../src/community/communityExperience.js';

export interface CommunityIdentityResolver {
  resolve(request: Request): Promise<CommunityRequestContext['identity'] | null>;
}

const MEMBERSHIP_ACTIONS = new Set<CommunityMembershipDecision>(['approve', 'reject', 'end']);
const MEMBERSHIP_ROLES = new Set<CommunityMemberRole>(['member', 'guardian', 'student', 'teacher', 'staff', 'leader', 'admin']);
const SCHOOL_ITEM_STAGES = new Set<SchoolFlowStage>(['announcement', 'schedule', 'supplies', 'child_notice']);

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function contextFor(request: Request, identity: CommunityRequestContext['identity']): CommunityRequestContext {
  return {
    identity,
    requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
    ...(request.headers.get('idempotency-key') ? { idempotencyKey: request.headers.get('idempotency-key')! } : {}),
  };
}

export async function handleCommunityRequest(input: {
  request: Request;
  service: CommunityApiService;
  identityResolver: CommunityIdentityResolver;
}): Promise<Response | null> {
  const { request, service, identityResolver } = input;
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/v1/community/')) return null;

  const identity = await identityResolver.resolve(request);
  if (!identity) return json({ error: 'UNAUTHENTICATED' }, 401);
  const context = contextFor(request, identity);
  const segments = url.pathname.split('/').filter(Boolean);

  try {
    if (request.method === 'GET' && url.pathname === '/v1/community/tab') return json(await service.getTab(context));

    if (segments[0] === 'v1' && segments[1] === 'community' && segments[2] === 'spaces' && segments[3]) {
      const spaceId = decodeURIComponent(segments[3]);
      if (request.method === 'GET' && segments.length === 4) {
        const result = await service.getSpace(context, spaceId);
        return result === null ? json({ error: 'NOT_FOUND' }, 404) : json(result);
      }
      if (request.method === 'POST' && segments[4] === 'join' && segments.length === 5) {
        await service.joinSpace(context, spaceId);
        return new Response(null, { status: 204 });
      }
      if (segments[4] === 'memberships') {
        if (request.method === 'GET' && segments.length === 5) return json(await service.getMembershipManagement(context, spaceId));
        if (request.method === 'PATCH' && segments[5] && segments.length === 6) {
          const membershipId = decodeURIComponent(segments[5]);
          const payload = (await request.json()) as { action?: unknown; roleKey?: unknown };
          if (typeof payload.action !== 'string' || !MEMBERSHIP_ACTIONS.has(payload.action as CommunityMembershipDecision)) return json({ error: 'INVALID_MEMBERSHIP_ACTION' }, 400);
          if (payload.roleKey !== undefined && (typeof payload.roleKey !== 'string' || !MEMBERSHIP_ROLES.has(payload.roleKey as CommunityMemberRole))) return json({ error: 'INVALID_MEMBERSHIP_ROLE' }, 400);
          const action = payload.action as CommunityMembershipDecision;
          const roleKey = typeof payload.roleKey === 'string' ? payload.roleKey as CommunityMemberRole : undefined;
          if (action === 'approve' && !roleKey) return json({ error: 'MEMBERSHIP_ROLE_REQUIRED' }, 400);
          await service.setMembershipDecision(context, spaceId, membershipId, action, roleKey);
          return new Response(null, { status: 204 });
        }
      }
      if (segments[4] === 'school-items' && segments.length === 5) {
        if (request.method === 'GET') return json({ items: await service.getSchoolItems(context, spaceId) });
        if (request.method === 'POST') {
          const payload = (await request.json()) as Record<string, unknown>;
          if (typeof payload.postId !== 'string' || !payload.postId.trim()) return json({ error: 'SCHOOL_ITEM_POST_REQUIRED' }, 400);
          if (typeof payload.stage !== 'string' || !SCHOOL_ITEM_STAGES.has(payload.stage as SchoolFlowStage)) return json({ error: 'SCHOOL_ITEM_STAGE_INVALID' }, 400);
          if (typeof payload.title !== 'string' || !payload.title.trim()) return json({ error: 'SCHOOL_ITEM_TITLE_REQUIRED' }, 400);
          if (typeof payload.detail !== 'string' || !payload.detail.trim()) return json({ error: 'SCHOOL_ITEM_DETAIL_REQUIRED' }, 400);
          if (typeof payload.actionRequired !== 'boolean' || typeof payload.sensitive !== 'boolean') return json({ error: 'SCHOOL_ITEM_FLAGS_REQUIRED' }, 400);
          if (payload.dueAt !== undefined && typeof payload.dueAt !== 'string') return json({ error: 'SCHOOL_ITEM_INVALID_DUE_AT' }, 400);
          if (payload.recipientUserId !== undefined && typeof payload.recipientUserId !== 'string') return json({ error: 'SCHOOL_ITEM_PRIVATE_RECIPIENT_REQUIRED' }, 400);
          await service.createSchoolItem(context, spaceId, {
            postId: payload.postId,
            stage: payload.stage as SchoolFlowStage,
            title: payload.title,
            detail: payload.detail,
            actionRequired: payload.actionRequired,
            sensitive: payload.sensitive,
            ...(typeof payload.dueAt === 'string' ? { dueAt: payload.dueAt } : {}),
            ...(typeof payload.recipientUserId === 'string' ? { recipientUserId: payload.recipientUserId } : {}),
          });
          return new Response(null, { status: 204 });
        }
      }
      if (segments[4] === 'posts' && segments[5]) {
        const postId = decodeURIComponent(segments[5]);
        if (request.method === 'GET' && segments.length === 6) {
          const result = await service.getThread(context, spaceId, postId);
          return result === null ? json({ error: 'NOT_FOUND' }, 404) : json(result);
        }
        if (request.method === 'POST' && segments[6] === 'comments' && segments.length === 7) {
          const payload = (await request.json()) as { body?: unknown };
          if (typeof payload.body !== 'string' || !payload.body.trim()) return json({ error: 'INVALID_BODY' }, 400);
          await service.addComment(context, spaceId, postId, payload.body.trim());
          return new Response(null, { status: 204 });
        }
        if (request.method === 'POST' && segments[6] === 'reactions' && segments.length === 7) {
          const payload = (await request.json()) as { reactionKey?: unknown };
          if (typeof payload.reactionKey !== 'string' || !payload.reactionKey.trim()) return json({ error: 'INVALID_REACTION' }, 400);
          await service.setReaction(context, spaceId, postId, payload.reactionKey.trim());
          return new Response(null, { status: 204 });
        }
      }
    }

    return json({ error: 'NOT_FOUND' }, 404);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.message === 'IDEMPOTENCY_KEY_OPERATION_CONFLICT' || error.message === 'COMMUNITY_MEMBERSHIP_INVALID_TRANSITION') return json({ error: error.message }, 409);
    if (error.message === 'COMMUNITY_SPACE_NOT_FOUND') return json({ error: 'NOT_FOUND' }, 404);
    if (
      error.message === 'COMMUNITY_INVITE_REQUIRED' ||
      error.message === 'COMMUNITY_MEMBERSHIP_BLOCKED' ||
      error.message === 'COMMUNITY_MEMBERSHIP_MANAGE_FORBIDDEN' ||
      error.message === 'COMMUNITY_MEMBERSHIP_ROLE_ASSIGN_FORBIDDEN' ||
      error.message === 'COMMUNITY_READ_FORBIDDEN' ||
      error.message === 'COMMUNITY_INTERACTION_FORBIDDEN'
    ) return json({ error: error.message }, 403);
    if (error.message === 'SCHOOL_ITEM_RECIPIENT_NOT_ACTIVE' || error.message === 'SCHOOL_ITEM_SOURCE_POST_INVALID') return json({ error: error.message }, 409);
    if (error.message === 'COMMUNITY_MEMBERSHIP_ROLE_REQUIRED' || error.message.startsWith('SCHOOL_ITEM_')) return json({ error: error.message }, 400);
    throw error;
  }
}
