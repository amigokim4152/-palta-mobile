function ownerManaged(business) {
  return business.verification_status === 'claimed' || business.verification_status === 'verified';
}

function validPoint(point) {
  return Boolean(
    point &&
    typeof point === 'object' &&
    Number.isFinite(point.latitude) &&
    point.latitude >= -90 &&
    point.latitude <= 90 &&
    Number.isFinite(point.longitude) &&
    point.longitude >= -180 &&
    point.longitude <= 180 &&
    (point.accuracy_m === undefined || (Number.isFinite(point.accuracy_m) && point.accuracy_m >= 0)),
  );
}

function ensureOwnerLocationState(business) {
  if (!business.public_location_precision) business.public_location_precision = 'exact';
  if (!business.owner_anchor_location && business.location) {
    business.owner_anchor_location = {
      latitude: business.location.lat,
      longitude: business.location.lng,
    };
  }
  if (!business.address_label && business.service_area_labels?.length) {
    business.address_label = business.service_area_labels[0];
  }
  if (!business.owner_location_updated_at) business.owner_location_updated_at = new Date(0).toISOString();
}

function ownerProjection(business) {
  ensureOwnerLocationState(business);
  return {
    business_id: business.id,
    ...(business.address_label ? { address_label: business.address_label } : {}),
    ...(business.owner_anchor_location ? { anchor_point: { ...business.owner_anchor_location } } : {}),
    public_precision: business.public_location_precision,
    service_area_labels: [...(business.service_area_labels ?? [])],
    updated_at: business.owner_location_updated_at,
  };
}

function applyPublicLocationProjection(business) {
  ensureOwnerLocationState(business);
  if (business.public_location_precision === 'exact' && business.owner_anchor_location) {
    business.location = {
      lat: business.owner_anchor_location.latitude,
      lng: business.owner_anchor_location.longitude,
    };
    business.public_address_label = business.address_label;
    return;
  }

  // area_only and hidden must not leave a precise point in the public Business
  // projection or distance-search fixture. Shared Geo/service-area discovery can
  // later project a safe regional centroid or polygon without exposing this anchor.
  delete business.location;
  if (business.public_location_precision === 'area_only') {
    business.public_address_label = business.address_label;
  } else {
    delete business.public_address_label;
  }
}

export function publicLocationForBusiness(business) {
  ensureOwnerLocationState(business);
  return {
    ...(business.public_address_label ? { address_label: business.public_address_label } : {}),
    ...(business.public_location_precision === 'exact' && business.location
      ? { location: business.location }
      : {}),
    service_area_labels: [...(business.service_area_labels ?? [])],
    public_precision: business.public_location_precision,
  };
}

export async function handleBusinessLocationRequest({ req, res, url, businesses, json, readJson }) {
  const match = url.pathname.match(/^\/v1\/business\/([^/]+)\/owner-location$/);
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

  ensureOwnerLocationState(business);
  if (req.method === 'GET') {
    json(res, 200, ownerProjection(business));
    return true;
  }

  const body = await readJson(req);
  if (body.address_label !== undefined) {
    if (typeof body.address_label !== 'string') {
      json(res, 400, { error: 'address_label_must_be_string' });
      return true;
    }
    const address = body.address_label.trim();
    if (address.length > 240) {
      json(res, 400, { error: 'address_label_too_long' });
      return true;
    }
    business.address_label = address;
  }

  if (body.anchor_point !== undefined) {
    if (!validPoint(body.anchor_point)) {
      json(res, 400, { error: 'anchor_point_invalid' });
      return true;
    }
    business.owner_anchor_location = {
      latitude: body.anchor_point.latitude,
      longitude: body.anchor_point.longitude,
      ...(body.anchor_point.accuracy_m !== undefined ? { accuracy_m: body.anchor_point.accuracy_m } : {}),
    };
  }

  if (body.public_precision !== undefined) {
    if (!['exact', 'area_only', 'hidden'].includes(body.public_precision)) {
      json(res, 400, { error: 'public_precision_invalid' });
      return true;
    }
    if (body.public_precision === 'exact' && !business.owner_anchor_location) {
      json(res, 400, { error: 'exact_location_requires_anchor' });
      return true;
    }
    if (
      body.public_precision === 'exact' &&
      (business.presence_modes ?? []).includes('private_home_base') &&
      !(business.presence_modes ?? []).some((mode) => ['storefront', 'fixed_stand', 'fixed_location'].includes(mode))
    ) {
      json(res, 400, { error: 'private_home_exact_location_forbidden' });
      return true;
    }
    business.public_location_precision = body.public_precision;
  }

  if (body.service_area_labels !== undefined) {
    if (!Array.isArray(body.service_area_labels)) {
      json(res, 400, { error: 'service_area_labels_required' });
      return true;
    }
    const labels = body.service_area_labels.map((item) => typeof item === 'string' ? item.trim() : null);
    if (labels.some((item) => item === null || !item || item.length > 120)) {
      json(res, 400, { error: 'service_area_label_invalid' });
      return true;
    }
    if (labels.length > 20) {
      json(res, 400, { error: 'service_area_limit_exceeded' });
      return true;
    }
    business.service_area_labels = [...new Set(labels)];
  }

  business.owner_location_updated_at = new Date().toISOString();
  applyPublicLocationProjection(business);
  json(res, 200, ownerProjection(business));
  return true;
}
