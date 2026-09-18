import {
  HOME_CAPABILITIES,
  homeCapability,
  requiredDemoCapabilityKeys,
} from '../src/home/homeCapabilityRegistry.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const keys = HOME_CAPABILITIES.map((item) => item.key);
assert(new Set(keys).size === keys.length, 'Home capability keys must be unique');
assert(keys.length >= 37, 'Home capability registry is unexpectedly incomplete');

const requiredSurfaces = [
  'context',
  'glance',
  'now',
  'in_progress',
  'upcoming',
  'useful_today',
] as const;
for (const surface of requiredSurfaces) {
  assert(
    HOME_CAPABILITIES.some((item) => item.surface === surface),
    `Home capability surface missing: ${surface}`,
  );
}

for (const key of [
  'context.locality',
  'context.notifications',
  'glance.weather',
  'glance.bus_eta',
  'glance.safety_status',
  'now.important_message',
  'now.emergency_alert',
  'now.payment_required',
  'progress.care_request',
  'progress.order',
  'progress.job_application',
  'progress.real_estate_inquiry',
  'progress.logistics_delivery',
  'upcoming.health_appointment',
  'upcoming.school_event',
  'upcoming.vehicle_lifecycle',
  'upcoming.pet_lifecycle',
  'upcoming.job_interview',
  'upcoming.property_viewing',
  'today.municipal_benefit',
  'today.local_news',
  'today.seasonal_fruit',
  'today.seasonal_vegetable',
  'today.seasonal_seafood',
  'today.followed_business_update',
  'today.jobs_nearby',
  'today.property_saved_change',
]) {
  assert(homeCapability(key), `Required Home capability missing: ${key}`);
}

assert(
  !homeCapability('today.seasonal_food'),
  'Seasonal food must remain split into fruit, vegetable, and seafood capabilities.',
);

const demoKeys = requiredDemoCapabilityKeys();
assert(new Set(demoKeys).size === demoKeys.length, 'Demo capability keys must be unique');
assert(demoKeys.length >= 37, 'Complete demo must cover the functional registry');

console.log(`PASS: Home capability registry (${keys.length} capabilities)`);
