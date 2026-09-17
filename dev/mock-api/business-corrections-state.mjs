import { randomUUID } from 'node:crypto';
import { handleBusinessOwnerProfileRequest } from './business-owner-profile-state.mjs';

const allowedFields = new Set([
  'name',
  'category',
  'description',
  'address',
  'location',
  'service_area',
  'phone',
  'whatsapp',
  'hours',
  'services',
  'channel_link',
  'lifecycle',
]);

const allowedReasons = new Set([
  'wrong_value',
  'outdated',
  'temporarily_changed',
  'business_moved',
  'business_closed',
  'other',
]);

const correctionsByBusiness = new Map();

function itemsFor(businessId) {
  return [...(correctionsByBusiness.get(businessId) ?? [])]
    .sort((a, b) => Date.parse(b.reported_at) - Date.parse(a.reported_at));
}

function ownerManaged(business) {
  return business.verification_status === 'claimed' || business.verification_status === 'verified';
}

function pendingOwnerItems(businessId) {
  return itemsFor(businessId).filter(
    (item) => item.queue_target === 'owner_review' && item.status === 'awaiting_owner_review',
  );
}

export async function handleBusinessCorrectionsRequest({ req, res, url, businesses, json, readJson }) {
  // The production contracts stay separated (`client.ownerProfile` vs
  // `client.corrections`). The small mock server delegates both here only to
  // avoid growing another monolithic route block in server.mjs.
  const ownerProfileHandled = await handleBusinessOwnerProfileRequest({
    req,
    res,
    url,
    businesses,
    json,
    readJson,
  });
  if (ownerProfileHandled) return true;

  const submitMatch = url.pathname.match(/^\/v1\/business\/([^/]+)\/corrections$/);
  if (submitMatch && req.method === 'POST') {
    const businessId = decodeURIComponent(submitMatch[1]);
    const business = businesses.find((item) => item.id === businessId);
    if (!business) {
      json(res, 404, { error: 'business_not_found' });
      return true;
    }

    const body = await readJson(req);
    if (!allowedFields.has(body.field)) {
      json(res, 400, { error: 'correction_field_invalid' });
      return true;
    }
    if (!allowedReasons.has(body.reason)) {
      json(res, 400, { error: 'correction_reason_invalid' });
      return true;
    }
    if (body.note !== undefined && typeof body.note !== 'string') {
      json(res, 400, { error: 'correction_note_must_be_string' });
      return true;
    }
    if (typeof body.note === 'string' && body.note.length > 1000) {
      json(res, 400, { error: 'correction_note_too_long' });
      return true;
    }

    const queueTarget = ownerManaged(business) ? 'owner_review' : 'trusted_review';
    const correction = {
      id: `correction-${randomUUID()}`,
      business_id: businessId,
      field: body.field,
      reason: body.reason,
      status: queueTarget === 'owner_review' ? 'awaiting_owner_review' : 'awaiting_trusted_review',
      reported_at: new Date().toISOString(),
      ...(typeof body.note === 'string' && body.note.trim() ? { note: body.note.trim() } : {}),
      queue_target: queueTarget,
    };

    const current = correctionsByBusiness.get(businessId) ?? [];
    correctionsByBusiness.set(businessId, [correction, ...current]);

    // A correction is evidence for review only. Never mutate canonical Business
    // facts from this endpoint, regardless of report count or wording.
    json(res, 202, correction);
    return true;
  }

  const resolutionMatch = url.pathname.match(
    /^\/v1\/business\/([^/]+)\/owner-corrections\/([^/]+)$/,
  );
  if (resolutionMatch && req.method === 'PUT') {
    const businessId = decodeURIComponent(resolutionMatch[1]);
    const correctionId = decodeURIComponent(resolutionMatch[2]);
    const business = businesses.find((item) => item.id === businessId);
    if (!business) {
      json(res, 404, { error: 'business_not_found' });
      return true;
    }
    if (!ownerManaged(business)) {
      json(res, 403, { error: 'owner_management_required' });
      return true;
    }

    const body = await readJson(req);
    if (body.resolution !== 'not_an_issue' && body.resolution !== 'reviewed_and_addressed') {
      json(res, 400, { error: 'correction_resolution_invalid' });
      return true;
    }
    const items = correctionsByBusiness.get(businessId) ?? [];
    const correction = items.find((item) => item.id === correctionId);
    if (!correction || correction.queue_target !== 'owner_review') {
      json(res, 404, { error: 'correction_not_found' });
      return true;
    }
    if (correction.status !== 'awaiting_owner_review') {
      json(res, 409, { error: 'correction_already_resolved' });
      return true;
    }

    correction.status = body.resolution === 'not_an_issue' ? 'rejected' : 'superseded';
    correction.resolved_at = new Date().toISOString();

    // Resolution only closes the review signal. Canonical facts must already
    // have been checked/updated through their own owner-management contract.
    json(res, 200, correction);
    return true;
  }

  const ownerMatch = url.pathname.match(/^\/v1\/business\/([^/]+)\/owner-corrections$/);
  if (ownerMatch && req.method === 'GET') {
    const businessId = decodeURIComponent(ownerMatch[1]);
    const business = businesses.find((item) => item.id === businessId);
    if (!business) {
      json(res, 404, { error: 'business_not_found' });
      return true;
    }
    if (!ownerManaged(business)) {
      json(res, 403, { error: 'owner_management_required' });
      return true;
    }
    json(res, 200, {
      business_id: businessId,
      items: pendingOwnerItems(businessId),
    });
    return true;
  }

  return false;
}
