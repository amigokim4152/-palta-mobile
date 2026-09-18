const baseUrl = process.env.PALTA_MOCK_BASE_URL ?? 'http://127.0.0.1:8792';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json();
  return { response, body };
}

const create = await request('/v1/local-business/quotes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'quote-smoke-idem-1',
  },
  body: JSON.stringify({
    description: 'Necesito revisar una filtración y comparar dos alternativas de atención.',
    recipient_business_ids: ['biz-taller-1', 'biz-farmacia-1'],
    service_taxonomy_ids: ['repair'],
  }),
});
assert(create.response.status === 201, 'quote creation should return 201');
assert(typeof create.body.id === 'string', 'quote creation should return quote id');
assert(typeof create.body.care_track_id === 'string', 'quote creation should return Shared Care id');
assert(create.body.status === 'collecting', 'new quote should collect responses');
assert(Array.isArray(create.body.responses) && create.body.responses.length === 0, 'new quote should start without fabricated responses');

const duplicate = await request('/v1/local-business/quotes', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'quote-smoke-idem-1',
  },
  body: JSON.stringify({
    description: 'Necesito revisar una filtración y comparar dos alternativas de atención.',
    recipient_business_ids: ['biz-taller-1', 'biz-farmacia-1'],
  }),
});
assert(duplicate.response.status === 200, 'idempotent quote replay should return existing request');
assert(duplicate.body.id === create.body.id, 'idempotent quote replay must preserve quote id');
assert(duplicate.body.care_track_id === create.body.care_track_id, 'idempotent quote replay must preserve Care id');

const initialOwnerInbox = await request('/v1/business/biz-taller-1/quote-requests');
assert(initialOwnerInbox.response.status === 200, 'recipient business should have an owner quote inbox');
assert(initialOwnerInbox.body.business_id === 'biz-taller-1', 'owner inbox must remain scoped to one canonical Business');
assert(initialOwnerInbox.body.items.length === 1, 'new quote should appear in the recipient business inbox');
assert(initialOwnerInbox.body.items[0].id === create.body.id, 'owner inbox should preserve quote identity');
assert(initialOwnerInbox.body.items[0].response === undefined, 'new owner inbox item should begin without fabricated business response');
assert(initialOwnerInbox.body.items[0].can_respond === true, 'new owner inbox item should accept a response');
assert(!('recipient_business_ids' in initialOwnerInbox.body.items[0]), 'owner inbox must not expose competitor recipient ids');
assert(!('responses' in initialOwnerInbox.body.items[0]), 'owner inbox must not expose competitor responses');
assert(!('selected_business_id' in initialOwnerInbox.body.items[0]), 'owner inbox must not reveal another selected business id');

const initialCare = await request(`/v1/care/${encodeURIComponent(create.body.care_track_id)}`);
assert(initialCare.response.status === 200, 'quote-created Care should use the shared Care route');
assert(initialCare.body.state === 'wait', 'quote-created Care should begin waiting');
assert(initialCare.body.waiting_for === 'business_response', 'quote-created Care should wait for business response');

const firstResponse = await request(
  `/v1/local-business/quotes/${encodeURIComponent(create.body.id)}/responses/biz-taller-1`,
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount_clp: 45000,
      note: 'Incluye revisión y mano de obra.',
      valid_until: '2026-09-25T23:59:59-03:00',
    }),
  },
);
assert(firstResponse.response.status === 200, 'recipient business should be able to submit quote response');
assert(firstResponse.body.status === 'responses_ready', 'first response should make comparison available');

const respondedOwnerInbox = await request('/v1/business/biz-taller-1/quote-requests');
const ownerItemAfterResponse = respondedOwnerInbox.body.items.find((item) => item.id === create.body.id);
assert(ownerItemAfterResponse?.response?.amount_clp === 45000, 'owner inbox should reflect only this business submitted amount');
assert(ownerItemAfterResponse?.response?.note === 'Incluye revisión y mano de obra.', 'owner inbox should preserve this business own response note');
assert(!('business_id' in ownerItemAfterResponse.response), 'owner inbox own response must not expose cross-business identifiers');

const secondResponse = await request(
  `/v1/local-business/quotes/${encodeURIComponent(create.body.id)}/responses/biz-farmacia-1`,
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount_clp: 38000,
      note: 'Alternativa de prueba para comparar el contrato de respuesta.',
      valid_until: '2026-09-25T23:59:59-03:00',
    }),
  },
);
assert(secondResponse.response.status === 200, 'second recipient should be able to submit quote response');
assert(secondResponse.body.responses.length === 2, 'two responses should be projected for comparison');
assert(secondResponse.body.responses[0].amount_clp === 38000, 'comparison should project lower known amount first');

const privateOwnerInbox = await request('/v1/business/biz-taller-1/quote-requests');
const privateOwnerItem = privateOwnerInbox.body.items.find((item) => item.id === create.body.id);
assert(privateOwnerItem?.response?.amount_clp === 45000, 'one owner must never see the competing lower amount in its inbox');
assert(JSON.stringify(privateOwnerItem).includes('38000') === false, 'owner inbox must not serialize competitor quote values');

const byCare = await request(`/v1/local-business/quotes/by-care/${encodeURIComponent(create.body.care_track_id)}`);
assert(byCare.response.status === 200, 'Care id should resolve its Local Business quote projection');
assert(byCare.body.id === create.body.id, 'Care quote projection should preserve quote identity');

const resultCare = await request(`/v1/care/${encodeURIComponent(create.body.care_track_id)}`);
assert(resultCare.body.state === 'result', 'business response should advance Care to result');
assert(resultCare.body.waiting_for === 'user_selection', 'Care should wait for user selection after responses');

const selected = await request(`/v1/local-business/quotes/${encodeURIComponent(create.body.id)}/select`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ business_id: 'biz-farmacia-1' }),
});
assert(selected.response.status === 200, 'user should be able to select a responding business');
assert(selected.body.status === 'selected', 'quote should record explicit selection');
assert(selected.body.selected_business_id === 'biz-farmacia-1', 'quote should preserve canonical selected Business id');
assert(selected.body.responses.find((item) => item.business_id === 'biz-farmacia-1')?.selected === true, 'selected response should be marked');

const closedOwnerInbox = await request('/v1/business/biz-taller-1/quote-requests');
const closedOwnerItem = closedOwnerInbox.body.items.find((item) => item.id === create.body.id);
assert(closedOwnerItem?.can_respond === false, 'owner inbox should close response editing after user selection');
assert(closedOwnerItem?.selected === false, 'non-selected owner may know it was not selected without learning who was selected');
assert(!('selected_business_id' in closedOwnerItem), 'non-selected owner inbox must not reveal selected competitor identity');

const followUpCare = await request(`/v1/care/${encodeURIComponent(create.body.care_track_id)}`);
assert(followUpCare.body.state === 'follow_up', 'selection should advance Shared Care to follow-up');
assert(followUpCare.body.waiting_for === 'selected_business_next_step', 'Care should track the next step after selection');

console.log('PASS: Local Business quote + owner inbox privacy + Shared Care HTTP smoke');