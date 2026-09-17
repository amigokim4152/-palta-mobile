import { BusinessOwnerProfileApiClient } from '../src/api/businessOwnerProfileApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: Array<{ input: string; method?: string; body?: string }> = [];
const client = new BusinessOwnerProfileApiClient({
  baseUrl: 'https://api.example.test',
  fetch: async (input, init) => {
    calls.push({
      input,
      ...(init?.method ? { method: init.method } : {}),
      ...(init?.body ? { body: init.body } : {}),
    });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          business_id: 'biz-1',
          description: 'Atención local actualizada.',
          contact: { phone: '+56220000000', whatsapp: '+56911111111' },
          updated_at: '2026-09-17T16:30:00-03:00',
        };
      },
    };
  },
});

const current = await client.getOwnerProfile('biz-1');
assert(current.business_id === 'biz-1', 'owner profile should preserve business identity');
assert(calls[0]?.input.endsWith('/v1/business/biz-1/owner-profile'), 'owner profile should use canonical route');

const updated = await client.updateOwnerProfile('biz-1', {
  description: '  Atención local actualizada.  ',
  phone: ' +56220000000 ',
  whatsapp: ' +56911111111 ',
});
assert(updated.contact.whatsapp === '+56911111111', 'owner profile update should return canonical contact projection');
assert(calls[1]?.method === 'PUT', 'owner profile update should use PUT');
const body = JSON.parse(calls[1]?.body ?? '{}') as Record<string, unknown>;
assert(body.description === 'Atención local actualizada.', 'owner profile client should trim description');
assert(body.phone === '+56220000000', 'owner profile client should trim phone');
assert(body.whatsapp === '+56911111111', 'owner profile client should trim WhatsApp');
assert(!('name' in body), 'basic owner profile endpoint must not silently mutate business identity');
assert(!('category' in body), 'basic owner profile endpoint must not bypass taxonomy');
assert(!('services' in body), 'basic owner profile endpoint must not bypass service taxonomy');
assert(!('location' in body), 'basic owner profile endpoint must not bypass location contracts');

console.log('PASS: Local Business free owner profile API');
