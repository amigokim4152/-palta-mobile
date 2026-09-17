import { randomUUID } from 'node:crypto';

const quoteRequests = new Map();
const quoteByCareTrack = new Map();
const quoteCareTracks = new Map();
const idempotencyQuoteIds = new Map();

function validInstant(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function projectQuote(quote, businesses) {
  const responses = [...(quote.responses ?? [])]
    .filter((item) => !item.valid_until || Date.parse(item.valid_until) > Date.now())
    .sort((a, b) => {
      const aAmount = Number.isInteger(a.amount_clp) ? a.amount_clp : Number.POSITIVE_INFINITY;
      const bAmount = Number.isInteger(b.amount_clp) ? b.amount_clp : Number.POSITIVE_INFINITY;
      if (aAmount !== bAmount) return aAmount - bAmount;
      return Date.parse(a.submitted_at) - Date.parse(b.submitted_at);
    })
    .map((item) => ({
      id: item.id,
      business_id: item.business_id,
      business_name: businesses.find((business) => business.id === item.business_id)?.name ?? 'Negocio',
      ...(Number.isInteger(item.amount_clp) ? { amount_clp: item.amount_clp } : {}),
      ...(item.note ? { note: item.note } : {}),
      ...(item.available_at ? { available_at: item.available_at } : {}),
      ...(item.valid_until ? { valid_until: item.valid_until } : {}),
      selected: quote.selected_business_id === item.business_id,
    }));

  return {
    id: quote.id,
    care_track_id: quote.care_track_id,
    description: quote.description,
    recipient_business_ids: [...quote.recipient_business_ids],
    status: quote.status,
    created_at: quote.created_at,
    ...(quote.requested_for ? { requested_for: quote.requested_for } : {}),
    ...(quote.selected_business_id ? { selected_business_id: quote.selected_business_id } : {}),
    responses,
  };
}

export async function handleBusinessQuotesRequest({ req, res, url, businesses, json, readJson }) {
  // This is only dev-mock composition. Production keeps one Shared Care Core;
  // the mock exposes the same /v1/care/{id} contract for quote-created tracks.
  const quoteCareMatch = req.method === 'GET'
    ? url.pathname.match(/^\/v1\/care\/([^/]+)$/)
    : null;
  if (quoteCareMatch) {
    const careTrackId = decodeURIComponent(quoteCareMatch[1]);
    const care = quoteCareTracks.get(careTrackId);
    if (care) {
      json(res, 200, care);
      return true;
    }
  }

  if (req.method === 'POST' && url.pathname === '/v1/local-business/quotes') {
    const body = await readJson(req);
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    if (description.length < 10) {
      json(res, 400, { error: 'quote_description_too_short' });
      return true;
    }
    if (description.length > 2000) {
      json(res, 400, { error: 'quote_description_too_long' });
      return true;
    }

    const recipients = Array.isArray(body.recipient_business_ids)
      ? [...new Set(body.recipient_business_ids.filter((id) => typeof id === 'string').map((id) => id.trim()).filter(Boolean))]
      : [];
    if (!recipients.length) {
      json(res, 400, { error: 'quote_recipient_required' });
      return true;
    }
    if (recipients.length > 10) {
      json(res, 400, { error: 'quote_recipient_limit_exceeded' });
      return true;
    }
    if (recipients.some((id) => !businesses.some((business) => business.id === id))) {
      json(res, 404, { error: 'quote_recipient_business_not_found' });
      return true;
    }

    if (body.requested_for !== undefined && !validInstant(body.requested_for)) {
      json(res, 400, { error: 'quote_requested_for_invalid' });
      return true;
    }
    if (body.media_refs !== undefined) {
      if (!Array.isArray(body.media_refs) || body.media_refs.length > 6 || body.media_refs.some((ref) => typeof ref !== 'string' || !ref.trim())) {
        json(res, 400, { error: 'quote_media_invalid' });
        return true;
      }
    }

    const idempotencyKey = req.headers['idempotency-key'];
    if (typeof idempotencyKey === 'string') {
      const existingId = idempotencyQuoteIds.get(idempotencyKey);
      const existing = existingId ? quoteRequests.get(existingId) : undefined;
      if (existing) {
        json(res, 200, projectQuote(existing, businesses));
        return true;
      }
    }

    const now = new Date().toISOString();
    const careTrackId = `care-${randomUUID()}`;
    quoteCareTracks.set(careTrackId, {
      id: careTrackId,
      intent_key: 'local_business_quote',
      state: 'wait',
      waiting_for: 'business_response',
      expected_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    const quote = {
      id: `quote-${randomUUID()}`,
      care_track_id: careTrackId,
      description,
      recipient_business_ids: recipients,
      service_taxonomy_ids: Array.isArray(body.service_taxonomy_ids)
        ? body.service_taxonomy_ids.filter((id) => typeof id === 'string' && id.trim())
        : [],
      status: 'collecting',
      created_at: now,
      ...(body.requested_for ? { requested_for: new Date(body.requested_for).toISOString() } : {}),
      ...(typeof body.service_area_id === 'string' && body.service_area_id.trim()
        ? { service_area_id: body.service_area_id.trim() }
        : {}),
      ...(Array.isArray(body.media_refs) && body.media_refs.length ? { media_refs: [...body.media_refs] } : {}),
      responses: [],
    };
    quoteRequests.set(quote.id, quote);
    quoteByCareTrack.set(careTrackId, quote.id);
    if (typeof idempotencyKey === 'string') idempotencyQuoteIds.set(idempotencyKey, quote.id);
    json(res, 201, projectQuote(quote, businesses));
    return true;
  }

  const byCareMatch = req.method === 'GET'
    ? url.pathname.match(/^\/v1\/local-business\/quotes\/by-care\/([^/]+)$/)
    : null;
  if (byCareMatch) {
    const careTrackId = decodeURIComponent(byCareMatch[1]);
    const quoteId = quoteByCareTrack.get(careTrackId);
    const quote = quoteId ? quoteRequests.get(quoteId) : undefined;
    if (quote) json(res, 200, projectQuote(quote, businesses));
    else json(res, 404, { error: 'quote_not_found' });
    return true;
  }

  const responseMatch = req.method === 'PUT'
    ? url.pathname.match(/^\/v1\/local-business\/quotes\/([^/]+)\/responses\/([^/]+)$/)
    : null;
  if (responseMatch) {
    const quoteId = decodeURIComponent(responseMatch[1]);
    const businessId = decodeURIComponent(responseMatch[2]);
    const quote = quoteRequests.get(quoteId);
    if (!quote) {
      json(res, 404, { error: 'quote_not_found' });
      return true;
    }
    if (!quote.recipient_business_ids.includes(businessId)) {
      json(res, 403, { error: 'business_not_quote_recipient' });
      return true;
    }

    const body = await readJson(req);
    if (body.amount_clp !== undefined && (!Number.isInteger(body.amount_clp) || body.amount_clp < 0)) {
      json(res, 400, { error: 'quote_amount_invalid' });
      return true;
    }
    if (body.note !== undefined && (typeof body.note !== 'string' || body.note.length > 2000)) {
      json(res, 400, { error: 'quote_note_invalid' });
      return true;
    }
    if (body.available_at !== undefined && !validInstant(body.available_at)) {
      json(res, 400, { error: 'quote_available_at_invalid' });
      return true;
    }
    if (body.valid_until !== undefined && !validInstant(body.valid_until)) {
      json(res, 400, { error: 'quote_valid_until_invalid' });
      return true;
    }

    const existing = quote.responses.find((item) => item.business_id === businessId);
    const response = {
      id: existing?.id ?? `quote-response-${randomUUID()}`,
      business_id: businessId,
      submitted_at: new Date().toISOString(),
      ...(body.amount_clp !== undefined ? { amount_clp: body.amount_clp } : {}),
      ...(typeof body.note === 'string' && body.note.trim() ? { note: body.note.trim() } : {}),
      ...(body.available_at ? { available_at: new Date(body.available_at).toISOString() } : {}),
      ...(body.valid_until ? { valid_until: new Date(body.valid_until).toISOString() } : {}),
    };
    quote.responses = existing
      ? quote.responses.map((item) => item.business_id === businessId ? response : item)
      : [...quote.responses, response];
    quote.status = 'responses_ready';

    const care = quoteCareTracks.get(quote.care_track_id);
    if (care) {
      care.state = 'result';
      care.waiting_for = 'user_selection';
      delete care.expected_at;
    }
    json(res, 200, projectQuote(quote, businesses));
    return true;
  }

  const selectMatch = req.method === 'PUT'
    ? url.pathname.match(/^\/v1\/local-business\/quotes\/([^/]+)\/select$/)
    : null;
  if (selectMatch) {
    const quoteId = decodeURIComponent(selectMatch[1]);
    const quote = quoteRequests.get(quoteId);
    if (!quote) {
      json(res, 404, { error: 'quote_not_found' });
      return true;
    }
    const body = await readJson(req);
    const businessId = typeof body.business_id === 'string' ? body.business_id : '';
    if (!quote.recipient_business_ids.includes(businessId)) {
      json(res, 400, { error: 'selected_business_not_recipient' });
      return true;
    }
    if (!quote.responses.some((item) => item.business_id === businessId)) {
      json(res, 409, { error: 'selected_business_has_no_response' });
      return true;
    }

    quote.selected_business_id = businessId;
    quote.status = 'selected';
    const care = quoteCareTracks.get(quote.care_track_id);
    if (care) {
      care.state = 'follow_up';
      care.waiting_for = 'selected_business_next_step';
      delete care.expected_at;
    }
    json(res, 200, projectQuote(quote, businesses));
    return true;
  }

  return false;
}
