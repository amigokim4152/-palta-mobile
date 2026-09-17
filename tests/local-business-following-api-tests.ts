import { PaltaApiClient } from '../src/api/paltaApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let requestedPath = '';
let requestedMethod = '';
const client = new PaltaApiClient({
  baseUrl: 'https://api.test',
  fetch: async (input, init) => {
    requestedPath = input;
    requestedMethod = init?.method ?? 'GET';
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          generated_at: '2026-09-17T13:45:00-03:00',
          items: [
            {
              id: 'post:post-1',
              business_id: 'biz-1',
              business_name: 'Café ejemplo',
              kind: 'post',
              title: 'Abrimos este sábado',
              body: 'De 10:00 a 14:00.',
              occurred_at: '2026-09-17T10:00:00-03:00',
            },
            {
              id: 'coupon:coupon-1',
              business_id: 'biz-1',
              business_name: 'Café ejemplo',
              kind: 'coupon',
              title: '10% para seguidores',
              occurred_at: '2026-09-17T09:00:00-03:00',
              expires_at: '2026-09-30T23:59:59-03:00',
            },
          ],
        };
      },
    };
  },
});

const result = await client.getFollowedBusinessUpdates();
assert(
  requestedPath.endsWith('/v1/local-business/following-updates'),
  'Following feed should use a Local Business relationship endpoint rather than generic Home.',
);
assert(String(requestedMethod) === 'GET', 'Following feed should be read-only.');
assert(result.items.length === 2, 'Following feed should return eligible relationship items.');
assert(result.items[0]?.business_id === 'biz-1', 'Following item must retain canonical business identity.');
assert(result.items[0]?.business_name === 'Café ejemplo', 'Following item must retain business display context.');
assert(result.items[0]?.kind === 'post', 'Following item should preserve post/coupon semantics.');
assert(
  !('notification_allowed' in (result.items[0] ?? {})),
  'Following feed projection must not carry or grant notification permission.',
);
assert(
  !('marketing_consent' in (result.items[0] ?? {})),
  'Following feed projection must not carry or grant marketing consent.',
);
assert(
  !('promotion_entitlement' in (result.items[0] ?? {})),
  'Free following feed must not depend on a commercial promotion entitlement.',
);

console.log('PASS: Local Business followed updates API contract');
