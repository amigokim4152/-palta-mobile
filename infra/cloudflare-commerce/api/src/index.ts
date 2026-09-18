import { Client } from 'pg';
import { BusinessAuthorizationService } from '../../../../src/access/businessAuthorizationService.js';
import {
  createHyperdrivePgDatabase,
  type PgClientConstructorLike,
} from '../../../../src/adapters/database/hyperdrivePgDatabase.js';
import { BusinessScopedSqlDatabase } from '../../../../src/persistence/businessScopedSqlDatabase.js';
import { PostgresBusinessOperationalGrantRepository } from '../../../../src/persistence/postgresBusinessOperationalGrantRepository.js';
import {
  PaltaAuthenticationError,
  verifySupabaseRequestIdentity,
} from './supabaseJwtVerifier.js';

type HyperdriveBinding = {
  connectionString: string;
};

type QueueProducerLike = {
  send(message: unknown): Promise<void>;
};

type Env = {
  PALTA_DB: HyperdriveBinding;
  PAYMENT_QUEUE: QueueProducerLike;
  FISCAL_QUEUE: QueueProducerLike;
  SUPABASE_URL: string;
  PALTA_RUNTIME?: string;
};

type ReadinessRow = {
  commerce_ready: boolean;
  payment_ready: boolean;
  grants_ready: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
} as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: SECURITY_HEADERS,
  });
}

function methodNotAllowed(allow: string): Response {
  return new Response(JSON.stringify({ ok: false, error: 'method_not_allowed' }), {
    status: 405,
    headers: {
      ...SECURITY_HEADERS,
      Allow: allow,
    },
  });
}

function database(env: Env) {
  return createHyperdrivePgDatabase(
    env.PALTA_DB,
    Client as unknown as PgClientConstructorLike,
  );
}

async function identityForRequest(request: Request, env: Env) {
  return verifySupabaseRequestIdentity({
    authorizationHeader: request.headers.get('Authorization'),
    supabaseUrl: env.SUPABASE_URL,
  });
}

async function checkDatabase(env: Env): Promise<Response> {
  const db = database(env);

  try {
    const result = await db.query<ReadinessRow>(`
      select
        to_regclass('public.commerce_transaction') is not null as commerce_ready,
        to_regclass('public.payment_intent') is not null as payment_ready,
        to_regclass('public.business_operational_grant') is not null as grants_ready
    `);
    const row = result.rows[0];
    const schemaReady = Boolean(
      row?.commerce_ready && row.payment_ready && row.grants_ready,
    );

    return json(
      {
        ok: schemaReady,
        service: 'palta-commerce-api',
        runtime: env.PALTA_RUNTIME ?? 'commerce_api',
        database: 'reachable',
        schema: {
          commerce: Boolean(row?.commerce_ready),
          payment: Boolean(row?.payment_ready),
          businessGrants: Boolean(row?.grants_ready),
        },
      },
      schemaReady ? 200 : 503,
    );
  } catch (error) {
    console.error('palta-commerce-api readiness failure', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown database failure',
    });

    return json(
      {
        ok: false,
        service: 'palta-commerce-api',
        runtime: env.PALTA_RUNTIME ?? 'commerce_api',
        database: 'unavailable',
      },
      503,
    );
  }
}

async function checkIdentity(request: Request, env: Env): Promise<Response> {
  try {
    const identity = await identityForRequest(request, env);
    return json({
      ok: true,
      userId: identity.userId,
    });
  } catch (error) {
    if (error instanceof PaltaAuthenticationError) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
    console.error('palta-commerce-api auth configuration failure', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return json({ ok: false, error: 'auth_unavailable' }, 503);
  }
}

async function checkBusinessAccess(
  request: Request,
  env: Env,
  businessId: string,
): Promise<Response> {
  let identity;
  try {
    identity = await identityForRequest(request, env);
  } catch (error) {
    if (error instanceof PaltaAuthenticationError) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }
    console.error('palta-commerce-api auth configuration failure', {
      name: error instanceof Error ? error.name : 'UnknownError',
    });
    return json({ ok: false, error: 'auth_unavailable' }, 503);
  }

  try {
    const scopedDb = new BusinessScopedSqlDatabase(database(env), businessId);
    const grants = new PostgresBusinessOperationalGrantRepository(scopedDb);
    const authorization = new BusinessAuthorizationService(
      grants,
      () => new Date().toISOString(),
    );
    const decision = await authorization.authorize({
      identity,
      businessId,
      capability: 'commerce.read',
    });

    if (!decision.allowed) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }

    return json({
      ok: true,
      businessId,
      role: decision.grant.role,
    });
  } catch (error) {
    console.error('palta-commerce-api business access failure', {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown database failure',
    });
    return json({ ok: false, error: 'authorization_unavailable' }, 503);
  }
}

function businessIdForAccessPath(pathname: string): string | null {
  const match = /^\/v1\/businesses\/([^/]+)\/access$/.exec(pathname);
  if (!match) return null;
  const businessId = match[1] ?? '';
  return UUID.test(businessId) ? businessId : '';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      return json({
        ok: true,
        service: 'palta-commerce-api',
        runtime: env.PALTA_RUNTIME ?? 'commerce_api',
      });
    }

    if (url.pathname === '/ready') {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      return checkDatabase(env);
    }

    if (url.pathname === '/v1/auth/identity') {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      return checkIdentity(request, env);
    }

    const businessId = businessIdForAccessPath(url.pathname);
    if (businessId !== null) {
      if (request.method !== 'GET') return methodNotAllowed('GET');
      if (!businessId) return json({ ok: false, error: 'invalid_business_id' }, 400);
      return checkBusinessAccess(request, env, businessId);
    }

    // Money-moving and fiscal endpoints intentionally remain closed until
    // idempotency, audit and provider-specific request contracts are wired
    // through this now-authenticated business authorization boundary.
    return json({ ok: false, error: 'not_found' }, 404);
  },
};
