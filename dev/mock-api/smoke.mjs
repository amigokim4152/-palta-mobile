const base = process.env.PALTA_MOCK_BASE_URL ?? 'http://127.0.0.1:8787';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(path, init) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  return { response, body };
}

const health = await json('/health');
assert(health.response.ok && health.body.ok === true, 'health failed');

const home = await json('/v1/home?locale=ko');
assert(home.response.ok && Array.isArray(home.body.items), 'home failed');
assert(home.body.locale === 'ko', 'home locale failed');
assert(
  home.body.items[0]?.title === '정비소 답변을 기다리고 있습니다',
  'home Korean content failed',
);

const local = await json(
  '/v1/local/search?lat=-33.39&lng=-70.57&radius_m=5000&locale=ko',
);
assert(local.response.ok && local.body.items.length >= 4, 'local search failed');
assert(local.body.locale === 'ko', 'local search locale failed');

const businessItem = local.body.items.find(
  (item) => item.entity_type === 'business',
);
const publicServiceItem = local.body.items.find(
  (item) => item.entity_type === 'public_service',
);
const eventItem = local.body.items.find((item) => item.entity_type === 'event');

assert(businessItem, 'business search result missing');
assert(
  businessItem.entity_type_label === '동네업체' &&
    typeof businessItem.category_key === 'string' &&
    typeof businessItem.category_label === 'string',
  'business localized metadata failed',
);
assert(publicServiceItem, 'public service search result missing');
assert(
  publicServiceItem.entity_type_label === '공공 서비스' &&
    publicServiceItem.category_key === 'municipal_service' &&
    publicServiceItem.category_label === '구청 서비스',
  'public service localized metadata failed',
);
assert(eventItem, 'event search result missing');
assert(
  eventItem.entity_type_label === '행사' &&
    eventItem.name === 'Feria vecinal de ejemplo',
  'event localized metadata or proper-name preservation failed',
);

const businessId = businessItem.entity_id;
const business = await json(
  `/v1/business/${encodeURIComponent(businessId)}?locale=ko`,
);
assert(business.response.ok && business.body.id === businessId, 'business detail failed');
assert(
  typeof business.body.category_key === 'string' &&
    typeof business.body.category_label === 'string' &&
    business.body.opening_status === 'open' &&
    business.body.opening_status_label === '영업 중',
  'business detail localized metadata failed',
);

const idempotencyKey = 'smoke-quote-1';
const care = await json('/v1/care', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify({
    intent_key: 'local_business_quote',
    subject_entity_id: businessId,
    action_type: 'quote_request',
    payload: { description: 'Ruido al frenar' },
  }),
});
assert(care.response.status === 201 && care.body.state === 'wait', 'care create failed');

const careRepeat = await json('/v1/care', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify({
    intent_key: 'local_business_quote',
    subject_entity_id: businessId,
    action_type: 'quote_request',
    payload: { description: 'Ruido al frenar' },
  }),
});
assert(
  careRepeat.response.ok && careRepeat.body.id === care.body.id,
  'care idempotency failed',
);

const careRead = await json(`/v1/care/${encodeURIComponent(care.body.id)}`);
assert(careRead.response.ok && careRead.body.id === care.body.id, 'care read failed');

console.log('PASS: Palta mock API HTTP smoke');
console.log(JSON.stringify({
  locale: local.body.locale,
  homeItems: home.body.items.length,
  localItems: local.body.items.length,
  businessId,
  publicServiceId: publicServiceItem.entity_id,
  eventId: eventItem.entity_id,
  careId: care.body.id,
}, null, 2));
