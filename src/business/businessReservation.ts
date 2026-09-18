export type BusinessReservationStatus =
  | 'requested'
  | 'confirmed'
  | 'declined'
  | 'cancelled';

export type BusinessReservation = Readonly<{
  id: string;
  careTrackId: string;
  businessId: string;
  requestedFor: string;
  status: BusinessReservationStatus;
  channel: 'whatsapp';
  createdAt: string;
  updatedAt: string;
  note?: string;
  ownerNote?: string;
  respondedAt?: string;
}>;

export type BusinessReservationOwnerDecision = 'confirmed' | 'declined';

function validInstant(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function validateBusinessReservation(
  reservation: BusinessReservation,
): readonly string[] {
  const issues: string[] = [];
  if (!reservation.id.trim()) issues.push('reservation_id_required');
  if (!reservation.careTrackId.trim()) issues.push('reservation_care_track_id_required');
  if (!reservation.businessId.trim()) issues.push('reservation_business_id_required');
  if (!validInstant(reservation.createdAt)) issues.push('reservation_created_at_invalid');
  if (!validInstant(reservation.updatedAt)) issues.push('reservation_updated_at_invalid');
  if (!validInstant(reservation.requestedFor)) issues.push('reservation_requested_for_invalid');
  if (
    validInstant(reservation.createdAt) &&
    validInstant(reservation.requestedFor) &&
    Date.parse(reservation.requestedFor) <= Date.parse(reservation.createdAt)
  ) {
    issues.push('reservation_requested_for_must_be_future');
  }
  if (reservation.note && reservation.note.trim().length > 2000) {
    issues.push('reservation_note_too_long');
  }
  if (reservation.ownerNote && reservation.ownerNote.trim().length > 2000) {
    issues.push('reservation_owner_note_too_long');
  }
  if (reservation.respondedAt && !validInstant(reservation.respondedAt)) {
    issues.push('reservation_responded_at_invalid');
  }
  if (
    (reservation.status === 'confirmed' || reservation.status === 'declined') &&
    !reservation.respondedAt
  ) {
    issues.push('reservation_response_time_required');
  }
  return [...new Set(issues)];
}

export function canBusinessRespondToReservation(
  reservation: BusinessReservation,
): boolean {
  return reservation.status === 'requested';
}

export function applyBusinessReservationDecision(
  reservation: BusinessReservation,
  input: {
    decision: BusinessReservationOwnerDecision;
    respondedAt: string;
    ownerNote?: string;
  },
): BusinessReservation {
  if (validateBusinessReservation(reservation).length) {
    throw new Error('invalid_business_reservation');
  }
  if (!canBusinessRespondToReservation(reservation)) {
    throw new Error('reservation_already_resolved');
  }
  if (!validInstant(input.respondedAt)) {
    throw new Error('reservation_responded_at_invalid');
  }
  const ownerNote = input.ownerNote?.trim();
  if (ownerNote && ownerNote.length > 2000) {
    throw new Error('reservation_owner_note_too_long');
  }
  return {
    ...reservation,
    status: input.decision,
    respondedAt: input.respondedAt,
    updatedAt: input.respondedAt,
    ...(ownerNote ? { ownerNote } : {}),
  };
}
