import http from 'node:http';
import { randomUUID } from 'node:crypto';

const host = process.env.PALTA_MOCK_HOST ?? '127.0.0.1';
const port = Number(process.env.PALTA_MOCK_PORT ?? '8787');

const channelLabels = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  google_business: 'Google',
  whatsapp: 'WhatsApp',
  website: 'Sitio web',
  delivery_marketplace: 'Delivery',
  marketplace: 'Marketplace',
  other: 'Otro canal',
};

const businesses = [
  {
    id: 'biz-taller-1',
    name: 'Taller ejemplo',
    category_key: 'auto_repair',
    search_terms: ['taller', 'auto', 'mecánica', 'frenos', 'neumáticos'],
    verification_status: 'unverified',
    opening_status: 'Abierto hoy',
    operational_state: 'open_now',
    operational_confirmed_at: '2026-09-17T08:00:00-03:00',
    description: 'Mantención y reparación automotriz con atención por WhatsApp.',
    hours_summary: 'Lun–Vie 09:00–18:00 · Sáb 09:00–14:00',
    service_labels: ['Mantención', 'Frenos', 'Neumáticos'],
    service_area_labels: ['Vitacura', 'Las Condes'],
    photo_urls: [],
    posts: [
      { id: 'post-taller-1', title: 'Agenda disponible esta semana', published_at: '2026-09-16T14:00:00-03:00' },
    ],
    enabled_capabilities: ['quote'],
    channel_links: [
      { provider: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/' },
      { provider: 'google_business', label: 'Google', url: 'https://www.google.com/maps' },
    ],
    location: { lat: -33.3908, lng: -70.5707 },
    contact: { whatsapp: '+56000000000' },
  },
  {
    id: 'biz-farmacia-1',
    name: 'Farmacia ejemplo',
    category_key: 'pharmacy',
    search_terms: ['farmacia', 'salud', 'medicamentos'],
    verification_status: 'verified',
    opening_status: 'Abierto ahora',
    operational_state: 'open_now',
    operational_confirmed_at: '2026-09-17T08:00:00-03:00',
    description: 'Farmacia de barrio con atención presencial y consulta telefónica.',
    hours_summary: 'Lun–Sáb 09:00–20:00',
    service_labels: ['Farmacia', 'Cuidado personal'],
    service_area_labels: ['Vitacura'],
    photo_urls: [],
    posts: [],
    enabled_capabilities: [],
    channel_links: [
      { provider: 'website', label: 'Sitio web', url: 'https://example.com/' },
      { provider: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/' },
    ],
    location: { lat: -33.3942, lng: -70.5752 },
    contact: { phone: '+56000000001' },
  },
];

const idempotencyCareIds = new Map();
const idempotencyBusinessResults = new Map();
const businessRelationships = new Map();

const careTracks = new Map([
  ['care-demo-1', {
    id: 'care-demo-1',
    intent_key: 'local_business_quote',
    state: 'wait',
    waiting_for: 'business_response',
    expected_at: '2026-09-17T18:00:00-03:00',
  }],
]);

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeSafePublicUrl(value) {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!parsed.hostname || parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function relationshipFor(businessId) {
  const existing = businessRelationships.get(businessId);
  if (existing) return existing;
  const relationship = {
    business_id: businessId,
    saved: false,
    following: false,
    regular_customer: false,
    updated_at: new Date().toISOString(),
  };
  businessRelationships.set(businessId, relationship);
  return relationship;
}

function ownerGuidanceFor(business) {
  const items = [];

  if (business.verification_status !== 'verified') {
    items.push({
      id: `${business.id}:verification`,
      class: 'stale_or_inaccurate_truth',
      title: 'Completa la verificación del negocio',
      reason: 'La verificación permite controlar cambios sensibles y publicar beneficios del propietario con confianza.',
      target: `/business/manage/${business.id}/verification`,
      action_required: true,
      commercial: 'free',
    });
  }

  if (!(business.photo_urls ?? []).length) {
    items.push({
      id: `${business.id}:photo`,
      class: 'free_practical_improvement',
      title: 'Agrega una foto que explique tu negocio',
      reason: 'Una foto real ayuda a que alguien entienda más rápido qué encontrará aquí.',
      target: `/business/manage/${business.id}/photos`,
      action_required: false,
      commercial: 'free',
    });
  }

  if (!(business.channel_links ?? []).length) {
    items.push({
      id: `${business.id}:channels`,
      class: 'free_practical_improvement',
      title: 'Agrega los enlaces que ya usas',
      reason: 'Puedes mostrar Instagram, Facebook, TikTok, Google, WhatsApp o tu sitio. Solo necesitamos el enlace público.',
      target: `/business/manage/${business.id}/channels`,
      action_required: false,
      commercial: 'free',
    });
  }

  if (business.verification_status === 'verified') {
    items.push({
      id: `${business.id}:coupon`,
      class: 'free_practical_improvement',
      title: 'Prueba un beneficio simple para tus clientes',
      reason: 'El cupón básico puede dar una razón concreta para probar o volver a tu negocio.',
      target: `/business/manage/${business.id}/coupons`,
      action_required: false,
      commercial: 'free',
    });
  }

  return items.slice(0, 5);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) return json(res, 400, { error: 'bad_request' });
    if (req.method === 'OPTIONS') return json(res, 204, {});

    const url = new URL(req.url, `http://${req.headers.host ?? `${host}:${port}`}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'palta-mock-api', version: '0.6.0' });
    }

    if (req.method === 'GET' && url.pathname === '/v1/home') {
      return json(res, 200, {
        generated_at: new Date().toISOString(),
        items: [
          {
            id: 'home-care-demo-1',
            kind: 'status',
            title: 'Esperando respuesta del taller',
            body: 'Tu solicitud sigue en curso.',
            source_domain: 'local_business',
            delivery: 'home',
            care_track_id: 'care-demo-1',
          },
        ],
      });
    }

    if (req.method === 'GET' && url.pathname === '/v1/local/search') {
      const lat = Number(url.searchParams.get('lat'));
      const lng = Number(url.searchParams.get('lng'));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return json(res, 400, { error: 'lat_lng_required' });
      }
      const q = normalize(url.searchParams.get('q'));
      const matching = !q
        ? businesses
        : businesses.filter((business) => {
            const haystack = normalize([
              business.name,
              business.category_key,
              ...(business.search_terms ?? []),
            ].join(' '));
            return q.split(/\s+/).filter(Boolean).some((term) => haystack.includes(term));
          });
      return json(res, 200, {
        items: matching.map((business, index) => ({
          entity_id: business.id,
          entity_type: 'business',
          name: business.name,
          category_key: business.category_key,
          verification_status: business.verification_status,
          operational_state: business.operational_state,
          operational_confirmed_at: business.operational_confirmed_at,
          distance_m: index === 0 ? 850 : 1200,
          location: business.location,
        })),
      });
    }

    if (req.method === 'POST' && url.pathname === '/v1/business/onboarding') {
      const body = await readJson(req);
      const idempotencyKey = req.headers['idempotency-key'];
      if (typeof idempotencyKey === 'string') {
        const existing = idempotencyBusinessResults.get(idempotencyKey);
        if (existing) return json(res, 200, existing);
      }

      if (body.mode !== 'claim_existing' && body.mode !== 'create_new') {
        return json(res, 400, { error: 'invalid_onboarding_mode' });
      }
      if (typeof body.business_name !== 'string' || !body.business_name.trim()) {
        return json(res, 400, { error: 'business_name_required' });
      }
      if (!Array.isArray(body.confirmed_service_ids) || body.confirmed_service_ids.length === 0) {
        return json(res, 400, { error: 'confirmed_service_required' });
      }

      let business;
      if (body.mode === 'claim_existing') {
        business = businesses.find((item) => item.id === body.business_id);
        if (!business) return json(res, 404, { error: 'business_not_found' });
        if (business.verification_status === 'claimed' || business.verification_status === 'verified') {
          return json(res, 409, { error: 'business_already_claimed' });
        }
        business.verification_status = 'claimed';
      } else {
        const id = `biz-${randomUUID()}`;
        business = {
          id,
          name: body.business_name.trim(),
          category_key: body.confirmed_service_ids[0],
          search_terms: [body.owner_description, ...body.confirmed_service_ids].filter(Boolean),
          verification_status: 'claimed',
          opening_status: 'Horario por confirmar',
          operational_state: 'unknown_or_stale',
          description: body.owner_description ?? '',
          service_labels: body.confirmed_service_ids,
          service_area_labels: body.service_area_ids ?? [],
          photo_urls: [],
          posts: [],
          enabled_capabilities: [],
          channel_links: [],
          ...(body.anchor_location ? { location: body.anchor_location } : {}),
          contact: body.contact ?? {},
        };
        businesses.push(business);
      }

      const result = {
        business_id: business.id,
        verification_status: 'claimed',
        onboarding_status: 'verification_pending',
      };
      if (typeof idempotencyKey === 'string') {
        idempotencyBusinessResults.set(idempotencyKey, result);
      }
      return json(res, 201, result);
    }

    const relationshipMatch = url.pathname.match(/^\/v1\/business\/([^/]+)\/relationship$/);
    if (relationshipMatch && (req.method === 'GET' || req.method === 'PUT')) {
      const id = decodeURIComponent(relationshipMatch[1]);
      const business = businesses.find((item) => item.id === id);
      if (!business) return json(res, 404, { error: 'business_not_found' });

      const relationship = relationshipFor(id);
      if (req.method === 'PUT') {
        const body = await readJson(req);
        if (body.saved !== undefined && typeof body.saved !== 'boolean') {
          return json(res, 400, { error: 'saved_must_be_boolean' });
        }
        if (body.following !== undefined && typeof body.following !== 'boolean') {
          return json(res, 400, { error: 'following_must_be_boolean' });
        }
        if (body.saved !== undefined) relationship.saved = body.saved;
        if (body.following !== undefined) relationship.following = body.following;
        relationship.updated_at = new Date().toISOString();
      }
      return json(res, 200, relationship);
    }

    const channelLinksMatch = req.method === 'PUT'
      ? url.pathname.match(/^\/v1\/business\/([^/]+)\/channel-links$/)
      : null;
    if (channelLinksMatch) {
      const id = decodeURIComponent(channelLinksMatch[1]);
      const business = businesses.find((item) => item.id === id);
      if (!business) return json(res, 404, { error: 'business_not_found' });

      const body = await readJson(req);
      if (!Array.isArray(body.links)) {
        return json(res, 400, { error: 'links_required' });
      }

      const safeLinks = [];
      const seen = new Set();
      for (const raw of body.links) {
        const provider = raw?.provider;
        if (typeof provider !== 'string' || !(provider in channelLabels)) {
          return json(res, 400, { error: 'unsupported_channel_provider' });
        }
        const safeUrl = normalizeSafePublicUrl(raw?.url);
        if (!safeUrl) return json(res, 400, { error: 'unsafe_public_channel_url' });
        const key = `${provider}:${safeUrl}`;
        if (seen.has(key)) continue;
        seen.add(key);
        safeLinks.push({ provider, label: channelLabels[provider], url: safeUrl });
      }

      // Development adapter: production must also authorize the caller as an
      // allowed owner/staff member for this business before this replacement.
      business.channel_links = safeLinks;
      return json(res, 200, { business_id: business.id, links: safeLinks });
    }

    const ownerGuidanceMatch = req.method === 'GET'
      ? url.pathname.match(/^\/v1\/business\/([^/]+)\/owner-guidance$/)
      : null;
    if (ownerGuidanceMatch) {
      const id = decodeURIComponent(ownerGuidanceMatch[1]);
      const business = businesses.find((item) => item.id === id);
      return business
        ? json(res, 200, {
            business_id: business.id,
            generated_at: new Date().toISOString(),
            items: ownerGuidanceFor(business),
          })
        : json(res, 404, { error: 'business_not_found' });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/v1/business/')) {
      const id = decodeURIComponent(url.pathname.slice('/v1/business/'.length));
      const business = businesses.find((item) => item.id === id);
      return business
        ? json(res, 200, business)
        : json(res, 404, { error: 'business_not_found' });
    }

    if (req.method === 'POST' && url.pathname === '/v1/care') {
      const body = await readJson(req);
      if (typeof body.intent_key !== 'string' || !body.intent_key) {
        return json(res, 400, { error: 'intent_key_required' });
      }

      const idempotencyKey = req.headers['idempotency-key'];
      if (typeof idempotencyKey === 'string') {
        const existingId = idempotencyCareIds.get(idempotencyKey);
        const existing = existingId ? careTracks.get(existingId) : undefined;
        if (existing) return json(res, 200, existing);
      }

      const id = `care-${randomUUID()}`;
      const care = {
        id,
        intent_key: body.intent_key,
        state: 'wait',
        waiting_for: 'business_response',
        expected_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      careTracks.set(id, care);
      if (typeof idempotencyKey === 'string') idempotencyCareIds.set(idempotencyKey, id);
      return json(res, 201, care);
    }

    if (req.method === 'GET' && url.pathname.startsWith('/v1/care/')) {
      const id = decodeURIComponent(url.pathname.slice('/v1/care/'.length));
      const care = careTracks.get(id);
      return care
        ? json(res, 200, care)
        : json(res, 404, { error: 'care_not_found' });
    }

    return json(res, 404, { error: 'not_found' });
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: 'internal_error' });
  }
});

server.listen(port, host, () => {
  console.log(`Palta mock API listening on http://${host}:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
