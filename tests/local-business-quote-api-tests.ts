import { BusinessQuotesApiClient } from '../src/api/businessQuotesApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: Array<{ input: string; method?: string; body?: string; idempotencyKey?: string }> = [];
const quotePayload = {
  id: 'quote-1',
  care_track_id: 'care-1',
  description: 'Necesito reparar una fuga bajo el lavaplatos.',
  recipient_business_ids: ['biz-1', 'biz-2'],
  status: 'responses_ready',
  created_at: '2026-09-17T15:00:00-03:00',
  responses: [
    {
      id: 'response-1',
      business_id: 'biz-1',
      business_name: 'Gasfiter Uno',
      amount_clp: 45000,
      selected: false,
    },
    {
      id: 'response-2',
      business_id: 'biz-2',
      business_name: 'Gasfiter Dos',
      amount_clp: 38000,
      selected: false,
    },
  ],
};

const client = new BusinessQuotesApiClient({
  baseUrl: 'https://api.example.test',
  fetch: async (input, init) => {
    calls.push({
      input,
      ...(init?.method ? { method: init.method } : {}),
      ...(init?.body ? { body: init.body } : {}),
      ...(init?.headers?.['Idempotency-Key'] ? { idempotencyKey: init.headers['Idempotency-Key'] } : {}),
    });

    if (input.includes('/by-care/missing')) {
      return { ok: false, status: 404, async json() { return { error: 'not_found' }; } };
    }

    if (init?.method === 'PUT' && input.endsWith('/select')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ...quotePayload,
            status: 'selected',
            selected_business_id: 'biz-2',
            responses: quotePayload.responses.map((item) => ({
              ...item,
              selected: item.business_id === 'biz-2',
            })),
          };
        },
      };
    }

    return { ok: true, status: init?.method === 'POST' ? 201 : 200, async json() { return quotePayload; } };
  },
});

const created = await client.createQuoteRequest({
  description: 'Necesito reparar una fuga bajo el lavaplatos.',
  recipientBusinessIds: ['biz-1', 'biz-2'],
  idempotencyKey: 'idem-1',
});
assert(created.care_track_id === 'care-1', 'quote creation must return Shared Care linkage');
assert(created.responses.length === 2, 'quote detail should include comparable response projection');
const createCall = calls[0];
assert(createCall?.method === 'POST', 'quote creation should POST');
assert(createCall?.idempotencyKey === 'idem-1', 'quote creation should preserve idempotency');
const createBody = JSON.parse(createCall?.body ?? '{}') as Record<string, unknown>;
assert(Array.isArray(createBody.recipient_business_ids), 'quote creation should carry recipient business ids');
assert(!('care_state' in createBody), 'quote request must not let the client author Shared Care state');

const byCare = await client.getQuoteByCareTrack('care-1');
assert(byCare?.id === 'quote-1', 'care track should resolve its Local Business quote projection');
const missing = await client.getQuoteByCareTrack('missing');
assert(missing === null, 'non-quote Care tracks should not fail generic Care UI');

const selected = await client.selectBusiness('quote-1', 'biz-2');
assert(selected.status === 'selected', 'quote selection should update quote semantics');
assert(selected.selected_business_id === 'biz-2', 'quote selection should preserve selected canonical Business id');
assert(selected.responses.find((item) => item.business_id === 'biz-2')?.selected === true, 'selected response should be marked');

console.log('PASS: Local Business quote orchestration API client');
