import http from 'node:http';
import { randomUUID } from 'node:crypto';

const host = process.env.PALTA_MOCK_HOST ?? '127.0.0.1';
const port = Number(process.env.PALTA_MOCK_PORT ?? '8787');

const businesses = [
  {
    id: 'biz-taller-1',
    name: 'Taller ejemplo',
    category_key: 'auto_repair',
    verification_status: 'unverified',
    opening_status: 'open',
    location: { lat: -33.3908, lng: -70.5707 },
    contact: { whatsapp: '+56000000000' },
  },
  {
    id: 'biz-farmacia-1',
    name: 'Farmacia ejemplo',
    category_key: 'pharmacy',
    verification_status: 'verified',
    opening_status: 'open',
    location: { lat: -33.3942, lng: -70.5752 },
    contact: { phone: '+56000000001' },
  },
];

const idempotencyCareIds = new Map();

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
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(payload);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const server = http.createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) return json(res, 400, { error: 'bad_request' });
    if (req.method === 'OPTIONS') return json(res, 204, {});

    const url = new URL(req.url, `http://${req.headers.host ?? `${host}:${port}`}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'palta-mock-api', version: '0.2.0' });
    }

    if (req.method === 'GET' && url.pathname === '/v1/home') {
      return json(res, 200, {
        generated_at: new Date().toISOString(),
        locality_label: 'Vitacura',
        glance: [
          {
            id: 'weather',
            label: 'HOY',
            value: '23°',
            detail: '17° / 25°',
          },
          {
            id: 'bus-405',
            label: 'BUS 405',
            value: '6 min',
            detail: 'Los Leones',
          },
          {
            id: 'metro-l1',
            label: 'METRO L1',
            value: 'Normal',
          },
          {
            id: 'air',
            label: 'AIRE',
            value: 'Bueno',
          },
        ],
        items: [
          {
            id: 'home-care-demo-1',
            kind: 'status',
            title: 'Esperando respuesta del taller',
            body: 'Tu solicitud sigue en curso. Palta la mantendrá visible hasta que cambie.',
            source_domain: 'local_business',
            delivery: 'home',
            care_track_id: 'care-demo-1',
          },
          {
            id: 'home-benefit-demo-1',
            kind: 'useful_today',
            title: 'Beneficio municipal cerca de ti',
            body: 'Cuando conectemos la fuente municipal, aquí aparecerán solo los beneficios relevantes para tu comuna y perfil.',
            source_domain: 'public-life',
            delivery: 'home',
          },
          {
            id: 'home-news-demo-1',
            kind: 'content',
            title: 'Resumen local de hoy',
            body: 'Las noticias locales ocuparán este espacio solo cuando Home esté poco cargado y sean útiles para tu zona.',
            source_domain: 'news',
            delivery: 'home',
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
      return json(res, 200, {
        items: businesses.map((business, index) => ({
          entity_id: business.id,
          entity_type: 'business',
          name: business.name,
          category_key: business.category_key,
          verification_status: business.verification_status,
          distance_m: index === 0 ? 1200 : 850,
          location: business.location,
        })),
      });
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
        if (existing) {
          return json(res, 200, existing);
        }
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

      if (typeof idempotencyKey === 'string') {
        idempotencyCareIds.set(idempotencyKey, id);
      }

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
