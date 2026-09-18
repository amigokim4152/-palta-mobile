import {
  SupabaseChileAdministrativeAreaAdapter,
} from '../src/adapters/supabaseChileAdministrativeAreaAdapter.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: Array<{
  input: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
}> = [];
const secret = 'country-layer-service-role-secret';
const adapter = new SupabaseChileAdministrativeAreaAdapter({
  projectUrl: 'https://example.supabase.co/',
  serviceRoleKey: secret,
  fetch: async (input, init) => {
    calls.push({ input, ...(init ? { init } : {}) });
    const body = JSON.parse(init?.body ?? '{}') as { p_refs?: string[] };
    const mapping: Record<string, { code: string; name: string; slug: string }> = {
      vitacura: { code: '13132', name: 'Vitacura', slug: 'vitacura' },
      providencia: { code: '13123', name: 'Providencia', slug: 'providencia' },
      nunoa: { code: '13120', name: 'Ñuñoa', slug: 'nunoa' },
    };
    return {
      ok: true,
      status: 200,
      async json() {
        return (body.p_refs ?? [])
          .map((ref) => {
            const value = mapping[ref];
            return value ? { input_ref: ref, ...value } : null;
          })
          .filter(Boolean);
      },
    };
  },
});

const codes = await adapter.resolveComunaCodes([
  'vitacura',
  'providencia',
  'vitacura',
  'nunoa',
]);
assert(codes.join('|') === '13132|13123|13120', 'Resolver must dedupe refs while preserving first-seen order.');
assert(calls.length === 1, 'Country Layer resolution should use one RPC call.');
assert(calls[0]?.input.endsWith('/rest/v1/rpc/palta_resolve_cl_comunas'), 'Resolver must use the canonical Country Layer RPC.');
const requestBody = JSON.parse(calls[0]?.init?.body ?? '{}') as { p_refs?: string[] };
assert(requestBody.p_refs?.join('|') === 'vitacura|providencia|nunoa', 'Resolver RPC must receive normalized unique refs.');
assert(calls[0]?.init?.headers?.Authorization === `Bearer ${secret}`, 'Only the trusted backend may authenticate Country Layer RPCs.');

let unresolved = false;
try {
  await adapter.resolveComunaCodes(['vitacura', 'unknown-comuna']);
} catch (error) {
  unresolved = error instanceof Error && error.message === 'unresolved_comuna_ref:unknown-comuna';
}
assert(unresolved, 'Unresolved comuna refs must fail closed.');

const callsBeforeInvalid = calls.length;
let tooLongRejected = false;
try {
  await adapter.resolveComunaCodes(['x'.repeat(121)]);
} catch (error) {
  tooLongRejected = error instanceof Error && error.message === 'invalid_comuna_ref';
}
assert(tooLongRejected, 'Oversized comuna refs must be rejected before network I/O.');
assert(calls.length === callsBeforeInvalid, 'Invalid comuna refs must not hit Supabase.');

const failing = new SupabaseChileAdministrativeAreaAdapter({
  projectUrl: 'https://example.supabase.co',
  serviceRoleKey: secret,
  fetch: async () => ({ ok: false, status: 503, async json() { return {}; } }),
});
let safeFailure = false;
try {
  await failing.resolveComunaCodes(['vitacura']);
} catch (error) {
  safeFailure = error instanceof Error
    && error.message === 'palta_resolve_cl_comunas_failed:503'
    && !error.message.includes(secret);
}
assert(safeFailure, 'Country Layer backend errors must not leak service-role credentials.');

console.log('PASS: Supabase Chile administrative-area resolver boundary');
