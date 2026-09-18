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
assert(home.body.contract_version === 'functional-home-v1', 'functional Home contract missing');
assert(home.body.context?.locality?.label === 'Vitacura', 'Home context/locality missing');
assert(typeof home.body.context?.notifications_target === 'string', 'Home notifications target missing');
assert(typeof home.body.context?.profile_target === 'string', 'Home profile target missing');
assert(Array.isArray(home.body.glance) && home.body.glance.length >= 2, 'Home glance missing');
assert(home.body.items.some((item) => item.surface === 'now'), 'Home AHORA item missing');
assert(home.body.items.some((item) => item.surface === 'in_progress'), 'Home EN CURSO item missing');
assert(home.body.items.some((item) => item.surface === 'upcoming'), 'Home PRÓXIMO item missing');
assert(home.body.items.some((item) => item.surface === 'useful_today'), 'Home PARA HOY item missing');
const careHomeItem = home.body.items.find((item) => item.care_track_id === 'care-demo-1');
assert(careHomeItem?.action_target === '/care/care-demo-1', 'Home Care deep link missing');

const notifications = await json('/v1/notifications');
assert(notifications.response.ok && Array.isArray(notifications.body.items), 'notifications failed');
assert(notifications.body.items.length >= 2, 'notification seed missing');
assert(
  notifications.body.summary?.unread_count === home.body.context.unread_notification_count,
  'Home unread count must come from the notification inbox state',
);
const unreadNotification = notifications.body.items.find((item) => !item.read_at);
assert(unreadNotification, 'an unread notification is required for the smoke flow');
const markRead = await json(
  `/v1/notifications/${encodeURIComponent(unreadNotification.id)}/read`,
  { method: 'POST' },
);
assert(
  markRead.response.ok && typeof markRead.body.read_at === 'string',
  'notification read transition failed',
);
const notificationsAfterRead = await json('/v1/notifications');
assert(
  notificationsAfterRead.body.summary.unread_count === notifications.body.summary.unread_count - 1,
  'notification unread count did not decrease',
);
const homeAfterRead = await json('/v1/home?locale=es-CL');
assert(
  homeAfterRead.body.context.unread_notification_count ===
    notificationsAfterRead.body.summary.unread_count,
  'Home unread count did not reflect notification read state',
);

const local = await json('/v1/local/search?lat=-33.39&lng=-70.57&radius_m=5000');
assert(local.response.ok && local.body.items.length >= 2, 'local search failed');
const businessId = local.body.items[0].entity_id;

const business = await json(`/v1/business/${encodeURIComponent(businessId)}`);
assert(business.response.ok && business.body.id === businessId, 'business detail failed');

// Use a unique idempotency key per smoke run so the same long-lived mock API
// process can be verified repeatedly. The second POST in this run still
// proves idempotency by reusing this exact key and expecting the same Care ID.
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
  homeContract: home.body.contract_version,
  homeItems: home.body.items.length,
  homeGlance: home.body.glance.length,
  locality: home.body.context.locality.label,
  unreadBefore: notifications.body.summary.unread_count,
  unreadAfter: notificationsAfterRead.body.summary.unread_count,
  localItems: local.body.items.length,
  businessId,
  careId: care.body.id,
}, null, 2));
