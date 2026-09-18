import { SupabaseLocalBusinessDiscoveryAdapter } from '../src/adapters/supabaseLocalBusinessDiscoveryAdapter.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: Array<{
  input: string;
  init?: { method?: string; headers?: Record<string, string>; body?: string };
}> = [];

const secret = 'service-role-test-secret';
const adapter = new SupabaseLocalBusinessDiscoveryAdapter({
  projectUrl: 'https://example.supabase.co/',
  serviceRoleKey: secret,
  fetch: async (input, init) => {
    calls.push({ input, ...(init ? { init } : {}) });
    return {
      ok: true,
      status: 200,
      async json() {
        return [
          {
            entity_id: 'biz-exact',
            entity_type: 'business',
            name: 'Taller Exacto',
            category_key: 'auto_repair',
            distance_m: 145.4,
            verification_status: 'verified',
            operational_state: 'open_now',
            operational_confirmed_at: '2026-09-18T09:00:00-03:00',
            location: { lat: -33.3908, lng: -70.5707 },
            preview: {
              image_url: 'https://cdn.example.test/taller.jpg',
              service_labels: ['Mecánica', 'Neumáticos'],
            },
          },
          {
            entity_id: 'biz-hidden',
            entity_type: 'business',
            name: 'Gasfiter a domicilio',
            category_key: 'home_repair',
            distance_m: null,
            verification_status: 'claimed',
            operational_state: 'unknown_or_stale',
            location: null,
            preview: { service_labels: ['Reparación a domicilio'] },
          },
        ];
      },
    };
  },
});

const items = await adapter.search({
  latitude: -33.3908,
  longitude: -70.5707,
  radiusM: 5000,
  query: 'taller',
  comunaCode: '13132',
  limit: 50,
});

assert(calls.length === 1, 'Search should issue exactly one canonical RPC request.');
const call = calls[0];
assert(call, 'RPC call should be captured.');
assert(
  call.input === 'https://example.supabase.co/rest/v1/rpc/local_business_search',
  'Adapter must call only the canonical discovery RPC.',
);
assert(call.init?.method === 'POST', 'Discovery RPC must use POST.');
assert(call.init?.headers?.apikey === secret, 'Server adapter must authenticate with service role.');
assert(
  call.init?.headers?.Authorization === `Bearer ${secret}`,
  'Server adapter must send the service role bearer token.',
);

const body = JSON.parse(call.init?.body ?? '{}') as Record<string, unknown>;
assert(body.p_lat === -33.3908 && body.p_lng === -70.5707, 'Coordinates must be forwarded unchanged.');
assert(body.p_radius_m === 5000, 'Radius must use the bounded canonical RPC parameter.');
assert(body.p_comuna_code === '13132', 'Comuna context must be forwarded for service-area discovery.');
assert(body.p_limit === 50, 'Limit must be forwarded.');

const exact = items.find((item) => item.entityId === 'biz-exact');
assert(exact?.location?.lat === -33.3908, 'Exact storefront may expose its public map point.');
assert(exact?.distanceM === 145, 'Exact storefront distance should be normalized to an integer.');
assert(exact?.preview?.serviceLabels.length === 2, 'Canonical preview should survive RPC normalization.');

const hidden = items.find((item) => item.entityId === 'biz-hidden');
assert(hidden, 'Service-area/hidden business should remain discoverable.');
assert(hidden.location === undefined, 'Hidden business must never gain a fabricated public point.');
assert(hidden.distanceM === undefined, 'Hidden business must never expose an exact distance.');

let invalidRejected = false;
try {
  await adapter.search({ latitude: 95, longitude: -70.57 });
} catch (error) {
  invalidRejected = error instanceof Error && error.message === 'invalid_local_business_search_latitude';
}
assert(invalidRejected, 'Invalid coordinates must be rejected before any backend request.');
assert(calls.length === 1, 'Invalid coordinates must not reach Supabase.');

const failing = new SupabaseLocalBusinessDiscoveryAdapter({
  projectUrl: 'https://example.supabase.co',
  serviceRoleKey: secret,
  fetch: async () => ({ ok: false, status: 503, async json() { return {}; } }),
});

let safeFailure = false;
try {
  await failing.search({ latitude: -33.39, longitude: -70.57 });
} catch (error) {
  safeFailure = error instanceof Error
    && error.message === 'local_business_search_failed:503'
    && !error.message.includes(secret);
}
assert(safeFailure, 'Backend errors must not leak the service-role credential.');

console.log('PASS: Supabase Local Business discovery adapter privacy boundary');
