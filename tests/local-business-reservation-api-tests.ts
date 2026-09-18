import { BusinessReservationsApiClient } from '../src/api/businessReservationsApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: Array<{ input: string; method?: string; body?: string; idempotencyKey?: string }> = [];
const reservationPayload = {
  id: 'reservation-1',
  business_id: 'biz-cafe-1',
  care_track_id: 'care-reservation-1',
  requested_for: '2026-09-20T18:00:00.000Z',
  status: 'requested',
  channel: 'whatsapp',
  created_at: '2026-09-18T19:00:00.000Z',
  updated_at: '2026-09-18T19:00:00.000Z',
  note: 'Mesa para cuatro personas.',
};

const client = new BusinessReservationsApiClient({
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
    if (input.includes('/business/biz-cafe-1/reservations')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { business_id: 'biz-cafe-1', items: [{ ...reservationPayload, can_respond: true }] };
        },
      };
    }
    if (init?.method === 'PUT') {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ...reservationPayload,
            status: 'confirmed',
            owner_note: 'Reserva confirmada.',
            responded_at: '2026-09-18T19:10:00.000Z',
            updated_at: '2026-09-18T19:10:00.000Z',
          };
        },
      };
    }
    return {
      ok: true,
      status: init?.method === 'POST' ? 201 : 200,
      async json() { return reservationPayload; },
    };
  },
});

const created = await client.createReservation({
  businessId: 'biz-cafe-1',
  requestedFor: '2026-09-20T18:00:00.000Z',
  note: 'Mesa para cuatro personas.',
  channel: 'whatsapp',
  messagingContextType: 'booking',
  messagingPurposeKey: 'reservation',
  idempotencyKey: 'reservation-idem-1',
});
assert(created.care_track_id === 'care-reservation-1', 'reservation creation must return Shared Care linkage');
const createCall = calls[0];
assert(createCall?.method === 'POST', 'reservation creation should POST');
assert(createCall?.idempotencyKey === 'reservation-idem-1', 'reservation creation should preserve idempotency');
const createBody = JSON.parse(createCall?.body ?? '{}') as Record<string, unknown>;
assert(createBody.business_id === 'biz-cafe-1', 'reservation must preserve canonical Business id');
assert(createBody.messaging_context_type === 'booking', 'reservation must preserve booking context');
assert(!('care_state' in createBody), 'reservation client must not author Shared Care state');

const inbox = await client.getBusinessInbox('biz-cafe-1');
assert(inbox.items[0]?.can_respond === true, 'verified owner inbox should expose pending response state');
assert(!('requester_user_id' in (inbox.items[0] ?? {})), 'owner inbox must not expose requester identity');

const confirmed = await client.respond('reservation-1', 'biz-cafe-1', {
  decision: 'confirmed',
  note: 'Reserva confirmada.',
});
assert(confirmed.status === 'confirmed', 'owner response should preserve confirmed state');

const byCare = await client.getByCareTrack('care-reservation-1');
assert(byCare?.id === 'reservation-1', 'Care id should resolve reservation projection');
const missing = await client.getByCareTrack('missing');
assert(missing === null, 'unrelated Care should not fail reservation lookup');

console.log('PASS: Local Business reservation API client');
