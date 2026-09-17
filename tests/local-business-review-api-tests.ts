import { BusinessReviewsApiClient } from '../src/api/businessReviewsApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: Array<{
  input: string;
  method?: string;
  authorization?: string;
  body?: string;
}> = [];

const publicReview = {
  id: 'review-1',
  author_label: 'María',
  rating: 5,
  body: 'Muy buena atención.',
  verified_interaction: true as const,
  evidence_label: 'Servicio realizado',
  created_at: '2026-09-17T10:00:00-03:00',
};

const client = new BusinessReviewsApiClient({
  baseUrl: 'https://api.example.test',
  getAccessToken: async () => 'token-1',
  fetch: async (input, init) => {
    calls.push({
      input,
      ...(init?.method ? { method: init.method } : {}),
      ...(init?.headers?.Authorization ? { authorization: init.headers.Authorization } : {}),
      ...(init?.body ? { body: init.body } : {}),
    });

    if (input.endsWith('/my-review-eligibility')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            business_id: 'biz-1',
            eligible: true,
            evidence: {
              kind: 'palta_service_completed',
              reference_id: 'service-1',
              label: 'Servicio realizado',
            },
            completed_at: '2026-09-17T09:00:00-03:00',
          };
        },
      };
    }

    if (init?.method === 'POST') {
      return {
        ok: true,
        status: 201,
        async json() {
          return {
            ...publicReview,
            id: 'review-created',
            author_label: 'Usuario Palta',
          };
        },
      };
    }

    if (init?.method === 'PUT') {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ...publicReview,
            business_reply: {
              body: 'Gracias por tu comentario.',
              replied_at: '2026-09-17T11:00:00-03:00',
            },
          };
        },
      };
    }

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          business_id: 'biz-1',
          summary: { count: 1, average_rating: 5 },
          items: [publicReview],
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

const eligibility = await client.getMyReviewEligibility('biz-1');
assert(eligibility.eligible, 'verified completed interaction should be eligible');
assert(
  eligibility.eligible && eligibility.evidence.reference_id === 'service-1',
  'eligibility should return the canonical evidence reference',
);

const created = await client.createBusinessReview('biz-1', {
  rating: 5,
  body: 'Muy buena atención.',
  evidenceKind: 'palta_service_completed',
  evidenceReferenceId: 'service-1',
});
assert(created.id === 'review-created', 'review write should return public projection');
const createCall = calls.find((call) => call.method === 'POST');
assert(createCall?.input.endsWith('/v1/business/biz-1/reviews'), 'review write should use canonical route');
const createBody = JSON.parse(createCall?.body ?? '{}') as Record<string, unknown>;
assert(createBody.evidence_reference_id === 'service-1', 'review write must carry verified evidence reference');
assert(!('author_user_id' in createBody), 'review write must not let client submit canonical reviewer id');

const replied = await client.replyToBusinessReview('biz-1', 'review-1', 'Gracias por tu comentario.');
assert(replied.business_reply?.body === 'Gracias por tu comentario.', 'verified owner reply should return on public review');
const replyCall = calls.find((call) => call.method === 'PUT');
assert(
  replyCall?.input.endsWith('/v1/business/biz-1/reviews/review-1/reply'),
  'owner reply should use review reply route',
);

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
