// Dev fixture only. Canonical production taxonomy remains the typed Chile
// service catalog under src/business; this subset exists only so HTTP smoke can
// validate ids without making the mock server a second taxonomy authority.
const serviceFixture = new Map([
  ['home.plumbing.general', { label: 'Gasfitería', discovery_group_key: 'HOME_REPAIR_MAINTENANCE' }],
  ['home.plumbing.drain_unclogging', { label: 'Destape y alcantarillado', discovery_group_key: 'HOME_REPAIR_MAINTENANCE' }],
  ['auto.repair.general', { label: 'Taller mecánico y reparación automotriz', discovery_group_key: 'AUTO_MOTO_MOBILITY' }],
  ['auto.tires.vulcanization', { label: 'Neumáticos y vulcanización', discovery_group_key: 'AUTO_MOTO_MOBILITY' }],
  ['health.pharmacy.general', { label: 'Farmacia y cuidado personal', discovery_group_key: 'HEALTH_PHARMACY' }],
]);

function ownerManaged(business) {
  return business.verification_status === 'claimed' || business.verification_status === 'verified';
}

function defaultServiceIds(business) {
  if (Array.isArray(business.owner_service_ids)) return business.owner_service_ids;
  if (business.category_key === 'auto_repair') return ['auto.repair.general', 'auto.tires.vulcanization'];
  if (business.category_key === 'pharmacy') return ['health.pharmacy.general'];
  return [];
}

function ensureState(business) {
  if (!Array.isArray(business.owner_service_ids)) business.owner_service_ids = defaultServiceIds(business);
  if (!Array.isArray(business.pending_owner_service_phrases)) business.pending_owner_service_phrases = [];
  if (!business.owner_services_updated_at) business.owner_services_updated_at = new Date(0).toISOString();
}

function projection(business) {
  ensureState(business);
  return {
    business_id: business.id,
    items: business.owner_service_ids.map((serviceId) => {
      const item = serviceFixture.get(serviceId);
      return {
        service_id: serviceId,
        label: item?.label ?? serviceId,
        discovery_group_key: item?.discovery_group_key ?? 'UNMAPPED',
      };
    }),
    pending_owner_phrases: [...business.pending_owner_service_phrases],
    updated_at: business.owner_services_updated_at,
  };
}

function normalizePending(raw) {
  if (!Array.isArray(raw)) return { error: 'pending_owner_phrases_required' };
  const values = raw.map((item) => typeof item === 'string' ? item.trim().replace(/\s+/g, ' ') : null);
  if (values.some((item) => item === null)) return { error: 'pending_owner_phrase_must_be_string' };
  const clean = values.filter(Boolean);
  if (clean.length > 5) return { error: 'pending_owner_phrase_limit_exceeded' };
  if (clean.some((item) => item.length > 120)) return { error: 'pending_owner_phrase_too_long' };
  const lower = clean.map((item) => item.toLocaleLowerCase('es-CL'));
  if (new Set(lower).size !== lower.length) return { error: 'duplicate_pending_owner_phrase' };
  return { values: clean };
}

export async function handleBusinessServicesRequest({ req, res, url, businesses, json, readJson }) {
  const match = url.pathname.match(/^\/v1\/business\/([^/]+)\/owner-services$/);
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
  if (!Array.isArray(body.canonical_service_ids)) {
    json(res, 400, { error: 'canonical_service_ids_required' });
    return true;
  }
  const canonical = body.canonical_service_ids
    .filter((id) => typeof id === 'string')
    .map((id) => id.trim())
    .filter(Boolean);
  if (canonical.length !== body.canonical_service_ids.length) {
    json(res, 400, { error: 'canonical_service_id_invalid' });
    return true;
  }
  if (canonical.length > 12) {
    json(res, 400, { error: 'canonical_service_limit_exceeded' });
    return true;
  }
  if (new Set(canonical).size !== canonical.length) {
    json(res, 400, { error: 'duplicate_canonical_service' });
    return true;
  }
  if (canonical.some((id) => !serviceFixture.has(id))) {
    json(res, 400, { error: 'unknown_canonical_service' });
    return true;
  }

  const pending = normalizePending(body.pending_owner_phrases ?? []);
  if (pending.error) {
    json(res, 400, { error: pending.error });
    return true;
  }

  business.owner_service_ids = canonical;
  business.pending_owner_service_phrases = pending.values;
  business.owner_services_updated_at = new Date().toISOString();
  // Public labels are a projection of canonical ids. Pending owner wording is
  // retained for taxonomy work but does not silently become a search category.
  business.service_labels = canonical.map((id) => serviceFixture.get(id).label);
  business.search_terms = [
    business.name,
    business.category_key,
    ...canonical.flatMap((id) => [id, serviceFixture.get(id).label]),
  ];

  json(res, 200, projection(business));
  return true;
}
