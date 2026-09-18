import http from 'node:http';
import { randomUUID } from 'node:crypto';
import {
  handleOperatingRulesRequest,
  refreshBusinessOperationalState,
} from './operating-rules-state.mjs';
import { handleBusinessReviewsRequest } from './business-reviews-state.mjs';
import { handleBusinessCorrectionsRequest } from './business-corrections-state.mjs';

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
      {
        id: 'post-taller-1',
        title: 'Agenda disponible esta semana',
        body: 'Consulta por horario antes de venir.',
        published_at: '2026-09-16T14:00:00-03:00',
      },
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
    enabled_capabilities: ['coupon'],
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
const idempotencyPostIds = new Map();
const businessRelationships = new Map();
const businessCoupons = new Map([
  ['biz-farmacia-1', {
    id: 'coupon-farmacia-demo',
    business_id: 'biz-farmacia-1',
    title: '10% en cuidado personal',
    description: 'Beneficio básico del negocio.',
    redemption_instruction: 'Muéstralo antes de pagar.',
    audience: 'public',
    status: 'published',
    starts_at: '2026-09-17T00:00:00-03:00',
    expires_at: '2026-10-17T23:59:59-03:00',
    issued_by_verified_owner_at: '2026-09-17T09:00:00-03:00',
  }],
]);

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

function couponProjection(coupon) {
  if (!coupon) return null;
  return {
    id: coupon.id,
    title: coupon.title,
    ...(coupon.description ? { description: coupon.description } : {}),
    ...(coupon.redemption_instruction ? { redemption_instruction: coupon.redemption_instruction } : {}),
    audience: coupon.audience,
    ...(coupon.expires_at ? { expires_at: coupon.expires_at } : {}),
  };
}

function isCanonicalCouponActive(businessId) {
  const coupon = businessCoupons.get(businessId);
  if (!coupon || coupon.status !== 'published') return false;
  const now = Date.now();
  if (coupon.starts_at && Date.parse(coupon.starts_at) > now) return false;
  if (coupon.expires_at && Date.parse(coupon.expires_at) <= now) return false;
  return true;
}

function activeCouponItems(businessId) {
  if (!isCanonicalCouponActive(businessId)) return [];
  const coupon = businessCoupons.get(businessId);
  if (coupon.audience === 'followers' && !relationshipFor(businessId).following) return [];
  const projected = couponProjection(coupon);
  return projected ? [projected] : [];
}

function ownerCouponProjection(businessId) {
  return couponProjection(businessCoupons.get(businessId));
}

function currentPostItems(business) {
  return [...(business.posts ?? [])]
    .sort((a, b) => Date.parse(b.published_at ?? '1970-01-01') - Date.parse(a.published_at ?? '1970-01-01'));
}

function discoveryPreviewFor(business) {
  const imageUrl = (business.photo_urls ?? [])
    .map(normalizeSafePublicUrl)
    .find(Boolean);
  const serviceLabels = [...new Set(
    (business.service_labels ?? [])
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter(Boolean),
  )].slice(0, 2);
  const activeCoupon = activeCouponItems(business.id)[0];
  const recentPost = currentPostItems(business)[0];
  const highlight = activeCoupon?.title ?? recentPost?.title;

  return {
    ...(imageUrl ? { image_url: imageUrl } : {}),
    ...(serviceLabels.length ? { service_labels: serviceLabels } : {}),
    ...(highlight ? { highlight } : {}),
  };
}

function followedUpdateItems() {
  const items = [];
  for (const business of businesses) {
    const relationship = businessRelationships.get(business.id);
    if (!relationship?.following) continue;

    for (const post of currentPostItems(business)) {
      if (!post.published_at || !Number.isFinite(Date.parse(post.published_at))) continue;
      items.push({
        id: `post:${post.id}`,
        business_id: business.id,
        business_name: business.name,
        kind: 'post',
        title: post.title,
        ...(post.body ? { body: post.body } : {}),
        occurred_at: post.published_at,
      });
    }

    if (isCanonicalCouponActive(business.id)) {
      const coupon = businessCoupons.get(business.id);
      const occurredAt = coupon?.starts_at ?? coupon?.issued_by_verified_owner_at;
      if (coupon && occurredAt && Number.isFinite(Date.parse(occurredAt))) {
        items.push({
          id: `coupon:${coupon.id}`,
          business_id: business.id,
          business_name: business.name,
          kind: 'coupon',
          title: coupon.title,
          ...(coupon.description ? { body: coupon.description } : {}),
          occurred_at: occurredAt,
          ...(coupon.expires_at ? { expires_at: coupon.expires_at } : {}),
        });
      }
    }
  }
  return items.sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
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

  if (business.verification_status === 'verified' && !isCanonicalCouponActive(business.id)) {
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
      return json(res, 200, { ok: true, service: 'palta-mock-api', version: '1.0.0' });
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
      for (const business of businesses) refreshBusinessOperationalState(business);
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
          ...discoveryPreviewFor(business),
        })),
      });
    }

    if (req.method === 'GET' && url.pathname === '/v1/local-business/following-updates') {
      return json(res, 200, {
        generated_at: new Date().toISOString(),
        items: followedUpdateItems(),
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
      if (typeof idempotencyKey === 'string') idempotencyBusinessResults.set(idempotencyKey, result);
      return json(res, 201, result);
    }

    const operatingRulesHandled = await handleOperatingRulesRequest({
      req,
      res,
      url,
      businesses,
      json,
      readJson,
    });
    if (operatingRulesHandled) return;

    const reviewsHandled = handleBusinessReviewsRequest({
      req,
      res,
      url,
      businesses,
      json,
    });
    if (reviewsHandled) return;

    const correctionsHandled = await handleBusinessCorrectionsRequest({
      req,
      res,
      url,
      businesses,
      json,
      readJson,
    });
    if (correctionsHandled) return;

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

    const couponsMatch = req.method === 'GET'
      ? url.pathname.match(/^\/v1\/business\/([^/]+)\/basic-coupons$/)
      : null;
    if (couponsMatch) {
      const id = decodeURIComponent(couponsMatch[1]);
      const business = businesses.find((item) => item.id === id);
      if (!business) return json(res, 404, { error: 'business_not_found' });
      return json(res, 200, { business_id: id, items: activeCouponItems(id) });
    }

    const ownerCouponMatch = req.method === 'GET'
      ? url.pathname.match(/^\/v1\/business\/([^/]+)\/owner-basic-coupon$/)
      : null;
    if (ownerCouponMatch) {
      const id = decodeURIComponent(ownerCouponMatch[1]);
      const business = businesses.find((item) => item.id === id);
      if (!business) return json(res, 404, { error: 'business_not_found' });
      const coupon = ownerCouponProjection(id);
      return json(res, 200, { business_id: id, ...(coupon ? { coupon } : {}) });
    }

    const couponWriteMatch = req.method === 'PUT'
      ? url.pathname.match(/^\/v1\/business\/([^/]+)\/basic-coupon$/)
      : null;
    if (couponWriteMatch) {
      const id = decodeURIComponent(couponWriteMatch[1]);
      const business = businesses.find((item) => item.id === id);
      if (!business) return json(res, 404, { error: 'business_not_found' });
      if (business.verification_status !== 'verified') {
        return json(res, 403, { error: 'verified_owner_required' });
      }

      const body = await readJson(req);
      if (body.status === 'revoked') {
        businessCoupons.delete(id);
        business.enabled_capabilities = (business.enabled_capabilities ?? [])
          .filter((capability) => capability !== 'coupon');
        return json(res, 200, { business_id: id, items: [] });
      }

      if (typeof body.title !== 'string' || !body.title.trim()) {
        return json(res, 400, { error: 'coupon_title_required' });
      }
      if (body.audience !== 'public' && body.audience !== 'followers') {
        return json(res, 400, { error: 'coupon_audience_invalid' });
      }
      const expiresAt = typeof body.expires_at === 'string' ? Date.parse(body.expires_at) : NaN;
      if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        return json(res, 400, { error: 'coupon_future_expiry_required' });
      }

      const existing = businessCoupons.get(id);
      const coupon = {
        id: existing?.id ?? `coupon-${randomUUID()}`,
        business_id: id,
        title: body.title.trim(),
        ...(typeof body.description === 'string' && body.description.trim()
          ? { description: body.description.trim() }
          : {}),
        ...(typeof body.redemption_instruction === 'string' && body.redemption_instruction.trim()
          ? { redemption_instruction: body.redemption_instruction.trim() }
          : {}),
        audience: body.audience,
        status: 'published',
        starts_at: new Date().toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
        issued_by_verified_owner_at: new Date().toISOString(),
      };
      businessCoupons.set(id, coupon);
      business.enabled_capabilities = [...new Set([...(business.enabled_capabilities ?? []), 'coupon'])];
      return json(res, 200, { business_id: id, items: activeCouponItems(id) });
    }

    const basicPostsCreateMatch = req.method === 'POST'
      ? url.pathname.match(/^\/v1\/business\/([^/]+)\/basic-posts$/)
      : null;
    if (basicPostsCreateMatch) {
      const id = decodeURIComponent(basicPostsCreateMatch[1]);
      const business = businesses.find((item) => item.id === id);
      if (!business) return json(res, 404, { error: 'business_not_found' });
      if (business.verification_status !== 'verified') {
        return json(res, 403, { error: 'verified_owner_required' });
      }

      const idempotencyKey = req.headers['idempotency-key'];
      if (typeof idempotencyKey === 'string') {
        const existingId = idempotencyPostIds.get(`${id}:${idempotencyKey}`);
        if (existingId && (business.posts ?? []).some((post) => post.id === existingId)) {
          return json(res, 200, { business_id: id, items: currentPostItems(business) });
        }
      }

      const body = await readJson(req);
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return json(res, 400, { error: 'post_title_required' });
      }
      if (body.title.trim().length > 120) {
        return json(res, 400, { error: 'post_title_too_long' });
      }
      if (body.body !== undefined && typeof body.body !== 'string') {
        return json(res, 400, { error: 'post_body_must_be_string' });
      }
      if (typeof body.body === 'string' && body.body.length > 2000) {
        return json(res, 400, { error: 'post_body_too_long' });
      }

      const post = {
        id: `post-${randomUUID()}`,
        title: body.title.trim(),
        ...(typeof body.body === 'string' && body.body.trim() ? { body: body.body.trim() } : {}),
        published_at: new Date().toISOString(),
      };
      business.posts = [post, ...(business.posts ?? [])];
      if (typeof idempotencyKey === 'string') {
        idempotencyPostIds.set(`${id}:${idempotencyKey}`, post.id);
      }
      return json(res, 201, { business_id: id, items: currentPostItems(business) });
    }

    const basicPostArchiveMatch = req.method === 'PUT'
      ? url.pathname.match(/^\/v1\/business\/([^/]+)\/basic-posts\/([^/]+)$/)
      : null;
    if (basicPostArchiveMatch) {
      const id = decodeURIComponent(basicPostArchiveMatch[1]);
      const postId = decodeURIComponent(basicPostArchiveMatch[2]);
      const business = businesses.find((item) => item.id === id);
      if (!business) return json(res, 404, { error: 'business_not_found' });
      if (business.verification_status !== 'verified') {
        return json(res, 403, { error: 'verified_owner_required' });
      }
      const body = await readJson(req);
      if (body.status !== 'archived') return json(res, 400, { error: 'archived_status_required' });
      if (!(business.posts ?? []).some((post) => post.id === postId)) {
        return json(res, 404, { error: 'post_not_found' });
      }
      business.posts = (business.posts ?? []).filter((post) => post.id !== postId);
      return json(res, 200, { business_id: id, items: currentPostItems(business) });
    }

    const channelLinksMatch = req.method === 'PUT'
      ? url.pathname.match(/^\/v1\/business\/([^/]+)\/channel-links$/)
      : null;
    if (channelLinksMatch) {
      const id = decodeURIComponent(channelLinksMatch[1]);
      const business = businesses.find((item) => item.id === id);
      if (!business) return json(res, 404, { error: 'business_not_found' });

      const body = await readJson(req);
      if (!Array.isArray(body.links)) return json(res, 400, { error: 'links_required' });

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

      business.channel_links = safeLinks;
      return json(res, 200, { business_id: business.id, links: safeLinks });
    }

    const ownerGuidanceMatch = req.method === 'GET'
      ? url.pathname.match(/^\/v1\/business\/([^/]+)\/owner-guidance$/)
      : null;
    if (ownerGuidanceMatch) {
      const id = decodeURIComponent(ownerGuidanceMatch[1]);
      const business = businesses.find((item) => item.id === id);
      if (business) refreshBusinessOperationalState(business);
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
      if (!business) return json(res, 404, { error: 'business_not_found' });
      refreshBusinessOperationalState(business);
      return json(res, 200, business);
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
      return care ? json(res, 200, care) : json(res, 404, { error: 'care_not_found' });
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
