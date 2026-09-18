import { CommunityApiService, CommunityRequestContext } from './communityBoundary';

export interface CommunityIdentityResolver {
  resolve(request: Request): Promise<CommunityRequestContext['identity'] | null>;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function contextFor(request: Request, identity: CommunityRequestContext['identity']): CommunityRequestContext {
  return {
    identity,
    requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
    ...(request.headers.get('idempotency-key')
      ? { idempotencyKey: request.headers.get('idempotency-key')! }
      : {}),
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
    if (request.method === 'GET' && url.pathname === '/v1/community/tab') {
      return json(await service.getTab(context));
    }

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
    if (error instanceof Error && error.message === 'IDEMPOTENCY_KEY_OPERATION_CONFLICT') {
      return json({ error: error.message }, 409);
    }
    throw error;
  }
}
