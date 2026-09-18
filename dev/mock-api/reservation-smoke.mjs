const baseUrl = process.env.PALTA_MOCK_BASE_URL ?? 'http://127.0.0.1:8795';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json();
  return { response, body };
}

const requestedFor = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
const create = await request('/v1/local-business/reservations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'reservation-smoke-idem-1',
  },
  body: JSON.stringify({
    business_id: 'biz-cafe-siete-granos',
    requested_for: requestedFor,
    channel: 'whatsapp',
    messaging_context_type: 'booking',
    messaging_purpose_key: 'reservation',
    note: 'Mesa para cuatro personas.',
  }),
});
assert(create.response.status === 201, 'reservation creation should return 201');
assert(typeof create.body.id === 'string', 'reservation should return canonical reservation id');
assert(typeof create.body.care_track_id === 'string', 'reservation should return Shared Care id');
assert(create.body.business_id === 'biz-cafe-siete-granos', 'reservation must preserve canonical Business id');
assert(create.body.status === 'requested', 'reservation request must not fabricate confirmation');

const duplicate = await request('/v1/local-business/reservations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': 'reservation-smoke-idem-1',
  },
  body: JSON.stringify({
    business_id: 'biz-cafe-siete-granos',
    requested_for: requestedFor,
    channel: 'whatsapp',
    messaging_context_type: 'booking',
    messaging_purpose_key: 'reservation',
  }),
});
assert(duplicate.response.status === 200, 'idempotent reservation replay should return existing request');
assert(duplicate.body.id === create.body.id, 'idempotent replay must preserve reservation id');
assert(duplicate.body.care_track_id === create.body.care_track_id, 'idempotent replay must preserve Care id');

const careWaiting = await request(`/v1/care/${encodeURIComponent(create.body.care_track_id)}`);
assert(careWaiting.response.status === 200, 'reservation-created Care should use shared Care route');
assert(careWaiting.body.state === 'wait', 'reservation Care should begin waiting');
assert(careWaiting.body.waiting_for === 'business_confirmation', 'reservation Care should wait for business confirmation');

const verifiedInbox = await request('/v1/business/biz-cafe-siete-granos/reservations');
assert(verifiedInbox.response.status === 200, 'verified business should have reservation inbox');
assert(verifiedInbox.body.items.length === 1, 'reservation should appear in verified owner inbox');
assert(verifiedInbox.body.items[0].can_respond === true, 'pending reservation should accept owner decision');
assert(!('requester_user_id' in verifiedInbox.body.items[0]), 'owner inbox must not expose requester identity');

const unverifiedInbox = await request('/v1/business/biz-taller-1/reservations');
assert(unverifiedInbox.response.status === 403, 'unverified business must not access reservation decision inbox');

const confirm = await request(`/v1/local-business/reservations/${encodeURIComponent(create.body.id)}/decision`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    business_id: 'biz-cafe-siete-granos',
    decision: 'confirmed',
    note: 'Mesa interior confirmada.',
  }),
});
assert(confirm.response.status === 200, 'verified owner should confirm reservation');
assert(confirm.body.status === 'confirmed', 'reservation should reflect explicit owner confirmation');
assert(confirm.body.owner_note === 'Mesa interior confirmada.', 'reservation should preserve owner response note');

const repeated = await request(`/v1/local-business/reservations/${encodeURIComponent(create.body.id)}/decision`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    business_id: 'biz-cafe-siete-granos',
    decision: 'declined',
  }),
});
assert(repeated.response.status === 409, 'resolved reservation must reject a second decision');

const careConfirmed = await request(`/v1/care/${encodeURIComponent(create.body.care_track_id)}`);
assert(careConfirmed.body.state === 'follow_up', 'confirmed reservation should advance same Care to follow-up');
assert(careConfirmed.body.waiting_for === 'scheduled_service', 'confirmed reservation should wait for scheduled service');

const byCare = await request(`/v1/local-business/reservations/by-care/${encodeURIComponent(create.body.care_track_id)}`);
assert(byCare.response.status === 200, 'Care id should resolve reservation projection');
assert(byCare.body.id === create.body.id, 'Care reservation projection should preserve reservation id');

console.log('PASS: Local Business reservation + verified owner inbox + Shared Care HTTP smoke');
