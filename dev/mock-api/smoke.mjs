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

const home = await json('/v1/home?locale=es-CL');
assert(home.response.ok && Array.isArray(home.body.items), 'home failed');
assert(home.body.locality_label === 'Vitacura', 'home locality failed');
assert(Array.isArray(home.body.glance) && home.body.glance.length > 0, 'home glance failed');
assert(Array.isArray(home.body.source_state), 'home source state failed');
assert(
  home.body.source_state.every((item) => typeof item.source_domain === 'string' && typeof item.data_mode === 'string'),
  'home source state contract failed',
);

const source = (domain) => home.body.source_state.find((item) => item.source_domain === domain);
const weatherState = source('weather');
const publicLifeState = source('public-life');
const newsState = source('news');
const schoolState = source('school');

assert(
  weatherState && (weatherState.data_mode === 'live' || weatherState.data_mode === 'unavailable'),
  'weather must be live or explicitly unavailable',
);
assert(
  publicLifeState && (publicLifeState.data_mode === 'scheduled' || publicLifeState.data_mode === 'unavailable'),
  'public-life must use the official scheduled source or be explicitly unavailable',
);
assert(
  newsState && (newsState.data_mode === 'scheduled' || newsState.data_mode === 'unavailable'),
  'news must use the official scheduled source or be explicitly unavailable',
);
assert(
  schoolState?.data_mode === 'demo',
  'development upcoming item must stay explicitly demo until a real calendar relationship is connected',
);

const weatherGlance = home.body.glance.find((item) => item.source_domain === 'weather');
if (weatherGlance) {
  assert(weatherGlance.data_mode === 'live', 'weather glance must never masquerade as live data');
}
assert(
  home.body.glance
    .filter((item) => item.source_domain === 'mobility')
    .every((item) => item.data_mode === 'demo'),
  'development mobility values must remain marked demo until realtime integration',
);
assert(
  !home.body.items.some((item) => item.id === 'home-benefit-demo-1' || item.id === 'home-news-demo-1'),
  'retired municipal/news demo cards must never reappear',
);
const upcomingDemo = home.body.items.find((item) => item.id === 'home-upcoming-demo-1');
assert(upcomingDemo?.kind === 'status', 'visual upcoming sample must remain a non-urgent status item');
assert(
  typeof upcomingDemo?.scheduled_at === 'string' && Number.isFinite(Date.parse(upcomingDemo.scheduled_at)),
  'visual upcoming sample must carry a valid scheduled_at value',
);

const local = await json('/v1/local/search?lat=-33.39&lng=-70.57&radius_m=5000');
assert(local.response.ok && local.body.items.length >= 2, 'local search failed');
const businessId = local.body.items[0].entity_id;

const business = await json(`/v1/business/${encodeURIComponent(businessId)}`);
assert(business.response.ok && business.body.id === businessId, 'business detail failed');

const idempotencyKey = `smoke-quote-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
  'care idempotency failed'
);

const careRead = await json(`/v1/care/${encodeURIComponent(care.body.id)}`);
assert(careRead.response.ok && careRead.body.id === care.body.id, 'care read failed');

console.log('PASS: Palta mock API HTTP smoke');
console.log(JSON.stringify({
  homeItems: home.body.items.length,
  glanceItems: home.body.glance.length,
  homeSources: home.body.source_state.length,
  weatherMode: weatherState.data_mode,
  publicLifeMode: publicLifeState.data_mode,
  newsMode: newsState.data_mode,
  schoolMode: schoolState.data_mode,
  localItems: local.body.items.length,
  businessId,
  careId: care.body.id,
}, null, 2));
