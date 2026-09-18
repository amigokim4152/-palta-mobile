import { randomUUID } from 'node:crypto';

const reservations = new Map();
const reservationByCareTrack = new Map();
const reservationCareTracks = new Map();
const idempotencyReservationIds = new Map();

function validInstant(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function projectReservation(reservation) {
  return {
    id: reservation.id,
    business_id: reservation.business_id,
    care_track_id: reservation.care_track_id,
    requested_for: reservation.requested_for,
    status: reservation.status,
    channel: reservation.channel,
    created_at: reservation.created_at,
    updated_at: reservation.updated_at,
    ...(reservation.note ? { note: reservation.note } : {}),
    ...(reservation.owner_note ? { owner_note: reservation.owner_note } : {}),
    ...(reservation.responded_at ? { responded_at: reservation.responded_at } : {}),
  };
}

function projectOwnerInboxItem(reservation) {
  return {
    ...projectReservation(reservation),
    can_respond: reservation.status === 'requested',
  };
}

export async function handleBusinessReservationsRequest({ req, res, url, businesses, json, readJson }) {
  const reservationCareMatch = req.method === 'GET'
    ? url.pathname.match(/^\/v1\/care\/([^/]+)$/)
    : null;
  if (reservationCareMatch) {
    const careTrackId = decodeURIComponent(reservationCareMatch[1]);
    const care = reservationCareTracks.get(careTrackId);
    if (care) {
      json(res, 200, care);
      return true;
    }
  }

  const ownerInboxMatch = req.method === 'GET'
    ? url.pathname.match(/^\/v1\/business\/([^/]+)\/reservations$/)
    : null;
  if (ownerInboxMatch) {
    const businessId = decodeURIComponent(ownerInboxMatch[1]);
    const business = businesses.find((item) => item.id === businessId);
    if (!business) {
      json(res, 404, { error: 'business_not_found' });
      return true;
    }
    if (business.verification_status !== 'verified') {
      json(res, 403, { error: 'verified_owner_required' });
      return true;
    }
    const items = [...reservations.values()]
      .filter((reservation) => reservation.business_id === businessId)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
      .map(projectOwnerInboxItem);
    json(res, 200, { business_id: businessId, items });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/v1/local-business/reservations') {
    const body = await readJson(req);
    const businessId = typeof body.business_id === 'string' ? body.business_id.trim() : '';
    const business = businesses.find((item) => item.id === businessId);
    if (!business) {
      json(res, 404, { error: 'business_not_found' });
      return true;
    }
    if (!(business.enabled_capabilities ?? []).includes('reservation')) {
      json(res, 409, { error: 'reservation_not_enabled' });
      return true;
    }
    if (body.channel !== 'whatsapp') {
      json(res, 400, { error: 'reservation_channel_invalid' });
      return true;
    }
    if (body.messaging_context_type !== 'booking') {
      json(res, 400, { error: 'reservation_context_invalid' });
      return true;
    }
    if (typeof body.messaging_purpose_key !== 'string' || !body.messaging_purpose_key.trim()) {
      json(res, 400, { error: 'reservation_purpose_required' });
      return true;
    }
    if (!validInstant(body.requested_for) || Date.parse(body.requested_for) <= Date.now()) {
      json(res, 400, { error: 'reservation_future_requested_for_required' });
      return true;
    }
    if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 2000)) {
      json(res, 400, { error: 'reservation_note_invalid' });
      return true;
    }

    const idempotencyKey = req.headers['idempotency-key'];
    if (typeof idempotencyKey === 'string') {
      const existingId = idempotencyReservationIds.get(idempotencyKey);
      const existing = existingId ? reservations.get(existingId) : undefined;
      if (existing) {
        json(res, 200, projectReservation(existing));
        return true;
      }
    }

    const now = new Date().toISOString();
    const careTrackId = `care-${randomUUID()}`;
    reservationCareTracks.set(careTrackId, {
      id: careTrackId,
      intent_key: 'local_business_reservation_request',
      state: 'wait',
      waiting_for: 'business_confirmation',
      expected_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const reservation = {
      id: `reservation-${randomUUID()}`,
      business_id: businessId,
      care_track_id: careTrackId,
      requested_for: new Date(body.requested_for).toISOString(),
      status: 'requested',
      channel: 'whatsapp',
      created_at: now,
      updated_at: now,
      messaging_context_type: 'booking',
      messaging_purpose_key: body.messaging_purpose_key.trim(),
      ...(typeof body.note === 'string' && body.note.trim() ? { note: body.note.trim() } : {}),
    };
    reservations.set(reservation.id, reservation);
    reservationByCareTrack.set(careTrackId, reservation.id);
    if (typeof idempotencyKey === 'string') {
      idempotencyReservationIds.set(idempotencyKey, reservation.id);
    }
    json(res, 201, projectReservation(reservation));
    return true;
  }

  const byCareMatch = req.method === 'GET'
    ? url.pathname.match(/^\/v1\/local-business\/reservations\/by-care\/([^/]+)$/)
    : null;
  if (byCareMatch) {
    const careTrackId = decodeURIComponent(byCareMatch[1]);
    const reservationId = reservationByCareTrack.get(careTrackId);
    const reservation = reservationId ? reservations.get(reservationId) : undefined;
    if (reservation) json(res, 200, projectReservation(reservation));
    else json(res, 404, { error: 'reservation_not_found' });
    return true;
  }

  const decisionMatch = req.method === 'PUT'
    ? url.pathname.match(/^\/v1\/local-business\/reservations\/([^/]+)\/decision$/)
    : null;
  if (decisionMatch) {
    const reservationId = decodeURIComponent(decisionMatch[1]);
    const reservation = reservations.get(reservationId);
    if (!reservation) {
      json(res, 404, { error: 'reservation_not_found' });
      return true;
    }

    const body = await readJson(req);
    const businessId = typeof body.business_id === 'string' ? body.business_id.trim() : '';
    if (businessId !== reservation.business_id) {
      json(res, 403, { error: 'business_not_reservation_owner' });
      return true;
    }
    const business = businesses.find((item) => item.id === businessId);
    if (!business || business.verification_status !== 'verified') {
      json(res, 403, { error: 'verified_owner_required' });
      return true;
    }
    if (reservation.status !== 'requested') {
      json(res, 409, { error: 'reservation_already_resolved' });
      return true;
    }
    if (body.decision !== 'confirmed' && body.decision !== 'declined') {
      json(res, 400, { error: 'reservation_decision_invalid' });
      return true;
    }
    if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 2000)) {
      json(res, 400, { error: 'reservation_owner_note_invalid' });
      return true;
    }

    const now = new Date().toISOString();
    reservation.status = body.decision;
    reservation.updated_at = now;
    reservation.responded_at = now;
    if (typeof body.note === 'string' && body.note.trim()) {
      reservation.owner_note = body.note.trim();
    }

    const care = reservationCareTracks.get(reservation.care_track_id);
    if (care) {
      if (body.decision === 'confirmed') {
        care.state = 'follow_up';
        care.waiting_for = 'scheduled_service';
      } else {
        care.state = 'result';
        care.waiting_for = 'user_next_step';
      }
      delete care.expected_at;
    }

    json(res, 200, projectReservation(reservation));
    return true;
  }

  return false;
}
