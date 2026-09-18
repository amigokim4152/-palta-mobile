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
assert(home.body.demo_mode === true, 'complete development Home must declare demo mode');
assert(typeof home.body.demo_label === 'string', 'complete development Home demo label missing');
assert(Array.isArray(home.body.demo_capability_keys), 'Home demo capability manifest missing');
assert(home.body.context?.locality?.label === 'Vitacura', 'Home context/locality missing');
assert(typeof home.body.context?.notifications_target === 'string', 'Home notifications target missing');
assert(typeof home.body.context?.profile_target === 'string', 'Home profile target missing');
assert(Array.isArray(home.body.glance) && home.body.glance.length >= 5, 'complete Home glance missing');
assert(home.body.glance.every((item) => item.data_mode === 'demo'), 'demo Glance must be explicitly marked demo');

const requiredCapabilities = [
  'context.locality',
  'context.notifications',
  'context.profile',
  'glance.weather',
  'glance.metro_status',
  'glance.bus_eta',
  'glance.air_quality',
  'glance.safety_status',
  'now.transport_arrival',
  'now.school_deadline',
  'now.payment_required',
  'now.quote_response',
  'now.important_message',
  'now.emergency_alert',
  'now.admin_deadline',
  'progress.care_request',
  'progress.order',
  'progress.municipal_application',
  'progress.community_membership',
  'progress.job_application',
  'progress.real_estate_inquiry',
  'progress.logistics_delivery',
  'progress.refund',
  'upcoming.health_appointment',
  'upcoming.school_event',
  'upcoming.community_event',
  'upcoming.vehicle_lifecycle',
  'upcoming.pet_lifecycle',
  'upcoming.job_interview',
  'upcoming.property_viewing',
  'upcoming.reservation',
  'upcoming.admin_renewal',
  'today.municipal_benefit',
  'today.community_notice',
  'today.local_news',
  'today.seasonal_food',
  'today.panorama',
  'today.followed_business_update',
  'today.local_service_change',
  'today.jobs_nearby',
  'today.property_saved_change',
];
for (const capability of requiredCapabilities) {
  assert(
    home.body.demo_capability_keys.includes(capability),
    `complete Home demo capability missing: ${capability}`,
  );
}

const visibleCapabilityKeys = new Set([
  ...home.body.glance.map((item) => item.capability_key).filter(Boolean),
  ...home.body.items.map((item) => item.capability_key).filter(Boolean),
]);
for (const capability of requiredCapabilities.filter((key) => !key.startsWith('context.'))) {
  assert(
    visibleCapabilityKeys.has(capability),
    `complete Home demo capability is not visibly represented: ${capability}`,
  );
}

const bySurface = (surface) => home.body.items.filter((item) => item.surface === surface);
assert(bySurface('now').length >= 7, 'complete Home AHORA scenario missing');
assert(bySurface('in_progress').length >= 8, 'complete Home EN CURSO scenario missing');
assert(bySurface('upcoming').length >= 9, 'complete Home PRÓXIMO scenario missing');
assert(bySurface('useful_today').length >= 9, 'complete Home PARA HOY scenario missing');
assert(home.body.items.every((item) => item.data_mode === 'demo'), 'demo Home items must be explicitly marked demo');

const requiredDomains = [
  'mobility',
  'school',
  'care',
  'commerce',
  'public-life',
  'community',
  'health',
  'vehicle',
  'pets',
  'news',
  'local-life',
  'play',
  'message',
  'safety',
  'jobs',
  'real-estate',
  'logistics',
  'local-business',
];
for (const domain of requiredDomains) {
  assert(
    home.body.items.some((item) => item.source_domain === domain),
    `complete Home demo missing domain: ${domain}`,
  );
}

const personalizedItems = home.body.items.filter((item) => item.personalized);
assert(personalizedItems.length >= 20, 'complete Home demo needs personalized examples');
assert(
  personalizedItems.every(
    (item) => item.subject && Array.isArray(item.corrections) && item.corrections.length > 0,
  ),
  'personalized demo items need subject and correction paths',
);

const careHomeItem = home.body.items.find((item) => item.care_track_id === 'care-demo-1');
assert(careHomeItem?.action_target === '/care/care-demo-1', 'Home Care deep link missing');

const profile = await json('/v1/profile');
assert(profile.response.ok, 'profile read failed');
assert(profile.body.preferred_language === 'es-CL', 'profile language missing');
assert(profile.body.timezone === 'America/Santiago', 'profile timezone missing');
const profileUpdate = await json('/v1/profile', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ preferred_name: '  Palta   Smoke  ' }),
});
assert(
  profileUpdate.response.ok && profileUpdate.body.preferred_name === 'Palta Smoke',
  'profile preferred name normalization/update failed',
);
const profileReadBack = await json('/v1/profile');
assert(profileReadBack.body.preferred_name === 'Palta Smoke', 'profile update did not persist');
const profileClear = await json('/v1/profile', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ preferred_name: null }),
});
assert(profileClear.response.ok && profileClear.body.preferred_name === undefined, 'profile clear failed');

const notifications = await json('/v1/notifications');
assert(notifications.response.ok && Array.isArray(notifications.body.items), 'notifications failed');
assert(notifications.body.items.length >= 2, 'notification seed missing');
assert(
  notifications.body.summary?.unread_count === home.body.context.unread_notification_count,
  'Home unread count must come from the notification inbox state',
);

let unreadAfter = notifications.body.summary.unread_count;
const unreadNotification = notifications.body.items.find((item) => !item.read_at);
if (unreadNotification) {
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
    notificationsAfterRead.body.summary.unread_count ===
      notifications.body.summary.unread_count - 1,
    'notification unread count did not decrease',
  );
  unreadAfter = notificationsAfterRead.body.summary.unread_count;
  const homeAfterRead = await json('/v1/home?locale=es-CL');
  assert(
    homeAfterRead.body.context.unread_notification_count === unreadAfter,
    'Home unread count did not reflect notification read state',
  );
} else {
  assert(
    notifications.body.summary.unread_count === 0,
    'notification summary is inconsistent with fully-read inbox',
  );
}

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
  'care idempotency failed',
);

const careRead = await json(`/v1/care/${encodeURIComponent(care.body.id)}`);
assert(careRead.response.ok && careRead.body.id === care.body.id, 'care read failed');

console.log('PASS: Palta mock API HTTP smoke');
console.log(JSON.stringify({
  homeContract: home.body.contract_version,
  homeCapabilities: home.body.demo_capability_keys.length,
  homeItems: home.body.items.length,
  homeGlance: home.body.glance.length,
  surfaces: {
    now: bySurface('now').length,
    inProgress: bySurface('in_progress').length,
    upcoming: bySurface('upcoming').length,
    usefulToday: bySurface('useful_today').length,
  },
  locality: home.body.context.locality.label,
  profileUpdate: 'ok',
  unreadBefore: notifications.body.summary.unread_count,
  unreadAfter,
  localItems: local.body.items.length,
  businessId,
  careId: care.body.id,
}, null, 2));
