const baseUrl = process.env.PALTA_MOCK_BASE_URL ?? 'http://127.0.0.1:8791';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = await response.json();
  return { response, payload };
}

const eligibility = await json('/v1/business/biz-farmacia-1/my-review-eligibility');
assert(eligibility.response.ok, 'review eligibility should respond');
assert(eligibility.payload.eligible === true, 'mock verified interaction should be eligible');
assert(
  eligibility.payload.evidence?.reference_id === 'visit-farmacia-mock-user-1',
  'eligibility should expose server-selected verified interaction reference',
);

const forged = await json('/v1/business/biz-farmacia-1/reviews', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    rating: 5,
    body: 'Intento con evidencia inventada.',
    evidence_kind: 'mutual_service_confirmation',
    evidence_reference_id: 'invented-reference',
  }),
});
assert(forged.response.status === 403, 'forged interaction evidence must be rejected');

const created = await json('/v1/business/biz-farmacia-1/reviews', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    rating: 5,
    body: 'Atención clara y rápida.',
    evidence_kind: eligibility.payload.evidence.kind,
    evidence_reference_id: eligibility.payload.evidence.reference_id,
  }),
});
assert(created.response.status === 201, 'verified interaction should create a review');
assert(created.payload.verified_interaction === true, 'created review should remain verified');
assert(!('author_user_id' in created.payload), 'created public review must not expose canonical user id');

const eligibilityAfter = await json('/v1/business/biz-farmacia-1/my-review-eligibility');
assert(eligibilityAfter.response.ok, 'eligibility should still respond after review');
assert(eligibilityAfter.payload.eligible === false, 'same interaction should no longer be eligible');
assert(eligibilityAfter.payload.reason === 'already_reviewed', 'duplicate prevention should explain already reviewed interaction');

const duplicate = await json('/v1/business/biz-farmacia-1/reviews', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    rating: 4,
    evidence_kind: eligibility.payload.evidence.kind,
    evidence_reference_id: eligibility.payload.evidence.reference_id,
  }),
});
assert(duplicate.response.status === 409, 'same verified interaction must not create a second review');

const replied = await json(
  `/v1/business/biz-farmacia-1/reviews/${encodeURIComponent(created.payload.id)}/reply`,
  {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: 'Gracias por compartir tu experiencia.' }),
  },
);
assert(replied.response.ok, 'verified owner should be able to reply');
assert(
  replied.payload.business_reply?.body === 'Gracias por compartir tu experiencia.',
  'owner reply should appear on public review projection',
);

const unverifiedReply = await json('/v1/business/biz-taller-1/reviews/review-taller-1/reply', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ body: 'No debería publicarse.' }),
});
assert(unverifiedReply.response.status === 403, 'unverified business must not publish official owner reply');

const reviews = await json('/v1/business/biz-farmacia-1/reviews');
assert(reviews.response.ok, 'reviews list should respond after write');
const visible = reviews.payload.items.find((item) => item.id === created.payload.id);
assert(visible, 'new verified review should appear in public list');
assert(!('author_user_id' in visible), 'public list must not expose canonical reviewer id');
assert(visible.business_reply?.body, 'owner reply should persist in public list');

console.log('PASS: Local Business verified review write HTTP smoke');
