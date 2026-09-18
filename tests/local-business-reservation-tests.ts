import {
  applyBusinessReservationDecision,
  canBusinessRespondToReservation,
  validateBusinessReservation,
  type BusinessReservation,
} from '../src/business/businessReservation.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const requested: BusinessReservation = {
  id: 'reservation-1',
  careTrackId: 'care-1',
  businessId: 'biz-cafe-1',
  requestedFor: '2026-09-20T18:00:00-03:00',
  status: 'requested',
  channel: 'whatsapp',
  createdAt: '2026-09-18T16:00:00-03:00',
  updatedAt: '2026-09-18T16:00:00-03:00',
  note: 'Mesa para cuatro personas.',
};

assert(validateBusinessReservation(requested).length === 0, 'valid reservation request should pass');
assert(canBusinessRespondToReservation(requested), 'requested reservation should accept one owner decision');

const confirmed = applyBusinessReservationDecision(requested, {
  decision: 'confirmed',
  respondedAt: '2026-09-18T16:10:00-03:00',
  ownerNote: 'Mesa interior confirmada.',
});
assert(confirmed.status === 'confirmed', 'owner decision should confirm reservation');
assert(confirmed.ownerNote === 'Mesa interior confirmada.', 'owner note should be preserved');
assert(!canBusinessRespondToReservation(confirmed), 'resolved reservation must not accept another decision');

let repeatedRejected = false;
try {
  applyBusinessReservationDecision(confirmed, {
    decision: 'declined',
    respondedAt: '2026-09-18T16:15:00-03:00',
  });
} catch (error) {
  repeatedRejected = error instanceof Error && error.message === 'reservation_already_resolved';
}
assert(repeatedRejected, 'reservation decision must be single-resolution');

const invalidPast: BusinessReservation = {
  ...requested,
  id: 'reservation-past',
  requestedFor: '2026-09-18T15:00:00-03:00',
};
assert(
  validateBusinessReservation(invalidPast).includes('reservation_requested_for_must_be_future'),
  'reservation must request a time after creation',
);

console.log('PASS: Local Business reservation state contract');
