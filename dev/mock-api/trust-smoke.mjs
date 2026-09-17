const baseUrl = process.env.PALTA_MOCK_BASE_URL ?? 'http://127.0.0.1:8790';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(url, init) {
  const response = await fetch(`${baseUrl}${url}`, init);
  const payload = await response.json();
  return { response, payload };
}

const reviews = await json('/v1/business/biz-taller-1/reviews');
assert(reviews.response.ok, 'verified reviews endpoint should respond');
assert(reviews.payload.summary?.count === 2, 'mock should expose verified review summary');
assert(Array.isArray(reviews.payload.items) && reviews.payload.items.length === 2, 'mock should expose review items');
assert(
  reviews.payload.items.every((item) => item.verified_interaction === true),
  'public review items must be verified interactions',
);
assert(
  reviews.payload.items.every((item) => !('author_user_id' in item) && !('authorUserId' in item)),
  'public review items must not expose canonical reviewer ids',
);

const before = await json('/v1/business/biz-farmacia-1');
assert(before.response.ok, 'business detail should respond before correction');

const correction = await json('/v1/business/biz-farmacia-1/corrections', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    field: 'hours',
    reason: 'outdated',
    note: 'El sábado estaba cerrado cuando fui.',
  }),
});
assert(correction.response.status === 202, 'fact correction should be accepted for review');
assert(correction.payload.status === 'awaiting_owner_review', 'verified owner should receive the correction');
assert(correction.payload.queue_target === 'owner_review', 'verified business correction should target owner review');

const after = await json('/v1/business/biz-farmacia-1');
assert(after.response.ok, 'business detail should respond after correction');
assert(
  after.payload.hours_summary === before.payload.hours_summary,
  'user correction must not automatically mutate canonical hours',
);
assert(
  JSON.stringify(after.payload.contact) === JSON.stringify(before.payload.contact),
  'user correction must not automatically mutate canonical contact data',
);

const ownerQueue = await json('/v1/business/biz-farmacia-1/owner-corrections');
assert(ownerQueue.response.ok, 'verified owner correction queue should respond');
assert(
  ownerQueue.payload.items.some((item) => item.id === correction.payload.id),
  'submitted correction should appear in owner review queue',
);

const unclaimed = await json('/v1/business/biz-taller-1/corrections', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ field: 'phone', reason: 'wrong_value' }),
});
assert(unclaimed.response.status === 202, 'unclaimed business correction should still be accepted');
assert(unclaimed.payload.queue_target === 'trusted_review', 'unclaimed business should route to trusted review');
assert(unclaimed.payload.status === 'awaiting_trusted_review', 'unclaimed business correction status should stay trusted-review pending');

const forbiddenOwnerQueue = await json('/v1/business/biz-taller-1/owner-corrections');
assert(forbiddenOwnerQueue.response.status === 403, 'unclaimed business must not expose an owner correction queue');

console.log('PASS: Local Business reviews + fact correction HTTP smoke');
