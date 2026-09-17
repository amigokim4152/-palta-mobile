import { BusinessReviewsApiClient } from '../src/api/businessReviewsApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: Array<{ input: string; authorization?: string }> = [];
const client = new BusinessReviewsApiClient({
  baseUrl: 'https://api.example.test',
  getAccessToken: async () => 'token-1',
  fetch: async (input, init) => {
    calls.push({
      input,
      ...(init?.headers?.Authorization ? { authorization: init.headers.Authorization } : {}),
    });
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          business_id: 'biz-1',
          summary: { count: 1, average_rating: 5 },
          items: [
            {
              id: 'review-1',
              author_label: 'María',
              rating: 5,
              body: 'Muy buena atención.',
              verified_interaction: true,
              evidence_label: 'Servicio realizado',
              created_at: '2026-09-17T10:00:00-03:00',
            },
          ],
        };
      },
    };
  },
});

const response = await client.getBusinessReviews('biz-1');
assert(response.business_id === 'biz-1', 'reviews should keep business id');
assert(response.summary.count === 1, 'reviews should include public summary');
assert(response.items[0]?.verified_interaction === true, 'reviews must remain verified interaction only');
assert(calls[0]?.input.endsWith('/v1/business/biz-1/reviews'), 'client should use canonical reviews route');
assert(calls[0]?.authorization === 'Bearer token-1', 'client should preserve authenticated API access');

const leakingClient = new BusinessReviewsApiClient({
  baseUrl: 'https://api.example.test',
  fetch: async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        business_id: 'biz-1',
        summary: { count: 1 },
        items: [
          {
            id: 'review-leak',
            author_label: 'Persona',
            author_user_id: 'user-secret',
            rating: 5,
            verified_interaction: true,
            evidence_label: 'Servicio realizado',
            created_at: '2026-09-17T10:00:00-03:00',
          },
        ],
      };
    },
  }),
});

let privacyRejected = false;
try {
  await leakingClient.getBusinessReviews('biz-1');
} catch {
  privacyRejected = true;
}
assert(privacyRejected, 'public review API client must reject canonical reviewer ids');

console.log('PASS: Local Business verified reviews API client');
