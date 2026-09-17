function ownerManaged(business) {
  return business.verification_status === 'claimed' || business.verification_status === 'verified';
}

function projection(business) {
  return {
    business_id: business.id,
    ...(business.description ? { description: business.description } : {}),
    contact: {
      ...(business.contact?.phone ? { phone: business.contact.phone } : {}),
      ...(business.contact?.whatsapp ? { whatsapp: business.contact.whatsapp } : {}),
    },
    updated_at: business.owner_profile_updated_at ?? new Date(0).toISOString(),
  };
}

function normalizeOptionalString(value, maxLength) {
  if (value === undefined) return { present: false };
  if (typeof value !== 'string') return { error: 'must_be_string' };
  const trimmed = value.trim();
  if (trimmed.length > maxLength) return { error: 'too_long' };
  return { present: true, value: trimmed };
}

export async function handleBusinessOwnerProfileRequest({
  req,
  res,
  url,
  businesses,
  json,
  readJson,
}) {
  const match = url.pathname.match(/^\/v1\/business\/([^/]+)\/owner-profile$/);
  if (!match || (req.method !== 'GET' && req.method !== 'PUT')) return false;

  const businessId = decodeURIComponent(match[1]);
  const business = businesses.find((item) => item.id === businessId);
  if (!business) {
    json(res, 404, { error: 'business_not_found' });
    return true;
  }
  if (!ownerManaged(business)) {
    json(res, 403, { error: 'owner_management_required' });
    return true;
  }

  if (req.method === 'GET') {
    json(res, 200, projection(business));
    return true;
  }

  const body = await readJson(req);
  const description = normalizeOptionalString(body.description, 1200);
  const phone = normalizeOptionalString(body.phone, 80);
  const whatsapp = normalizeOptionalString(body.whatsapp, 80);

  if (description.error) {
    json(res, 400, { error: `description_${description.error}` });
    return true;
  }
  if (phone.error) {
    json(res, 400, { error: `phone_${phone.error}` });
    return true;
  }
  if (whatsapp.error) {
    json(res, 400, { error: `whatsapp_${whatsapp.error}` });
    return true;
  }
  if (!description.present && !phone.present && !whatsapp.present) {
    json(res, 400, { error: 'owner_profile_update_empty' });
    return true;
  }

  if (description.present) business.description = description.value;
  business.contact = { ...(business.contact ?? {}) };
  if (phone.present) {
    if (phone.value) business.contact.phone = phone.value;
    else delete business.contact.phone;
  }
  if (whatsapp.present) {
    if (whatsapp.value) business.contact.whatsapp = whatsapp.value;
    else delete business.contact.whatsapp;
  }
  business.owner_profile_updated_at = new Date().toISOString();

  json(res, 200, projection(business));
  return true;
}
