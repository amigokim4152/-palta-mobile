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

const categoryLabels = {
  auto_repair: {
    'es-CL': 'Taller mecánico',
    ko: '자동차 정비',
    en: 'Auto repair',
    'zh-Hans': '汽车维修',
  },
  pharmacy: {
    'es-CL': 'Farmacia',
    ko: '약국',
    en: 'Pharmacy',
    'zh-Hans': '药房',
  },
};

const openingStatusLabels = {
  open: {
    'es-CL': 'Abierto',
    ko: '영업 중',
    en: 'Open',
    'zh-Hans': '营业中',
  },
};

const homeCopy = {
  'es-CL': [
    {
      id: 'home-care-demo-1',
      kind: 'status',
      title: 'Esperando respuesta del taller',
      body: 'Tu solicitud sigue en curso.',
      source_domain: 'local_business',
      delivery: 'home',
      care_track_id: 'care-demo-1',
    },
    {
      id: 'home-content-demo-1',
      kind: 'content',
      title: 'Información útil para hoy',
      body: 'Este contenido aparece porque Home está poco cargado.',
      source_domain: 'news',
      delivery: 'home',
    },
  ],
  ko: [
    {
      id: 'home-care-demo-1',
      kind: 'status',
      title: '정비소 답변을 기다리고 있습니다',
      body: '요청이 아직 진행 중입니다.',
      source_domain: 'local_business',
      delivery: 'home',
      care_track_id: 'care-demo-1',
    },
    {
      id: 'home-content-demo-1',
      kind: 'content',
      title: '오늘 알아두면 좋은 정보',
      body: '홈에 중요한 항목이 많지 않을 때 도움이 되는 내용을 보여줍니다.',
      source_domain: 'news',
      delivery: 'home',
    },
  ],
  en: [
    {
      id: 'home-care-demo-1',
      kind: 'status',
      title: 'Waiting for the repair shop',
      body: 'Your request is still in progress.',
      source_domain: 'local_business',
      delivery: 'home',
      care_track_id: 'care-demo-1',
    },
    {
      id: 'home-content-demo-1',
      kind: 'content',
      title: 'Useful information for today',
      body: 'This appears when Home has only a few higher-priority items.',
      source_domain: 'news',
      delivery: 'home',
    },
  ],
  'zh-Hans': [
    {
      id: 'home-care-demo-1',
      kind: 'status',
      title: '正在等待维修店回复',
      body: '你的请求仍在处理中。',
      source_domain: 'local_business',
      delivery: 'home',
      care_track_id: 'care-demo-1',
    },
    {
      id: 'home-content-demo-1',
      kind: 'content',
      title: '今天值得了解的信息',
      body: '当首页没有很多高优先级事项时，会显示有帮助的内容。',
      source_domain: 'news',
      delivery: 'home',
    },
  ],
};

function normalizeLocale(value) {
  if (!value) return 'es-CL';
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'ko' || normalized.startsWith('ko-')) return 'ko';
  if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  if (
    normalized === 'zh-hans' ||
    normalized === 'zh-cn' ||
    normalized === 'zh-sg'
  ) {
    return 'zh-Hans';
  }
  if (normalized === 'es-cl' || normalized === 'es') return 'es-CL';
  return 'es-CL';
}

function localizedLabel(catalog, key, locale) {
  return catalog[key]?.[locale] ?? catalog[key]?.['es-CL'] ?? key;
}

function localizedBusiness(business, locale) {
  return {
    ...business,
    category_label: localizedLabel(categoryLabels, business.category_key, locale),
    opening_status_label: localizedLabel(
      openingStatusLabels,
      business.opening_status,
      locale,
    ),
  };
}

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
    const locale = normalizeLocale(url.searchParams.get('locale'));

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'palta-mock-api', version: '0.2.0' });
    }

    if (req.method === 'GET' && url.pathname === '/v1/home') {
      return json(res, 200, {
        generated_at: new Date().toISOString(),
        locale,
        items: homeCopy[locale] ?? homeCopy['es-CL'],
      });
    }

    if (req.method === 'GET' && url.pathname === '/v1/local/search') {
      const lat = Number(url.searchParams.get('lat'));
      const lng = Number(url.searchParams.get('lng'));
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return json(res, 400, { error: 'lat_lng_required' });
      }
      return json(res, 200, {
        locale,
        items: businesses.map((business, index) => ({
          entity_id: business.id,
          entity_type: 'business',
          name: business.name,
          category_key: business.category_key,
          category_label: localizedLabel(
            categoryLabels,
            business.category_key,
            locale,
          ),
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
        ? json(res, 200, localizedBusiness(business, locale))
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
