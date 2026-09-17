const ownerLocationState = new Map();

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
  let state = ownerLocationState.get(business.id);
  if (!state) {
    state = {
      ...(business.location
        ? {
            anchor_point: {
              latitude: business.location.lat,
              longitude: business.location.lng,
            },
          }
        : {}),
      updated_at: new Date(0).toISOString(),
    };
    ownerLocationState.set(business.id, state);
  }
  if (!business.public_location_precision) business.public_location_precision = 'exact';
  if (!business.address_label && business.service_area_labels?.length) {
    business.address_label = business.service_area_labels[0];
  }
  return state;
}

function ownerProjection(business) {
  const state = ensureOwnerLocationState(business);
  return {
    business_id: business.id,
    ...(business.address_label ? { address_label: business.address_label } : {}),
    ...(state.anchor_point ? { anchor_point: { ...state.anchor_point } } : {}),
    public_precision: business.public_location_precision,
    service_area_labels: [...(business.service_area_labels ?? [])],
    updated_at: state.updated_at,
  };
}

function applyPublicLocationProjection(business) {
  const state = ensureOwnerLocationState(business);
  if (business.public_location_precision === 'exact' && state.anchor_point) {
    business.location = {
      lat: state.anchor_point.latitude,
      lng: state.anchor_point.longitude,
    };
    business.public_address_label = business.address_label;
    return;
  }

  // area_only and hidden must not leave a precise point in the public Business
  // projection or the distance-search fixture. Shared Geo/service-area discovery
  // can later provide a safe regional centroid/polygon without exposing this anchor.
  delete business.location;
  if (business.public_location_precision === 'area_only') {
    business.public_address_label = business.address_label;
  } else {
    delete business.public_address_label;
  }
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

  const state = ensureOwnerLocationState(business);
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
    state.anchor_point = {
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
    if (body.public_precision === 'exact' && !state.anchor_point) {
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

  state.updated_at = new Date().toISOString();
  applyPublicLocationProjection(business);
  json(res, 200, ownerProjection(business));
  return true;
}
