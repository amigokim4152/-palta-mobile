import { Client } from 'pg';
import {
  createHyperdrivePgDatabase,
  type PgClientConstructorLike,
} from '../../../../src/adapters/database/hyperdrivePgDatabase.js';

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
  PALTA_RUNTIME?: string;
};

type ReadinessRow = {
  commerce_ready: boolean;
  payment_ready: boolean;
  grants_ready: boolean;
};

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

async function checkDatabase(env: Env): Promise<Response> {
  const db = createHyperdrivePgDatabase(
    env.PALTA_DB,
    Client as unknown as PgClientConstructorLike,
  );

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

    // Money-moving and fiscal endpoints intentionally remain closed until
    // Supabase JWT verification, canonical business grant resolution,
    // idempotency and request audit boundaries are wired end-to-end.
    return json({ ok: false, error: 'not_found' }, 404);
  },
};
