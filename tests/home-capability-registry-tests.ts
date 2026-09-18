import {
  HOME_CAPABILITIES,
  homeCapability,
  requiredDemoCapabilityKeys,
} from '../src/home/homeCapabilityRegistry.js';
import {
  HOME_LIFE_CARD_PARITY,
  requiredLegacyLifeCardCapabilityKeys,
} from '../src/home/homeLifeCardParity.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const keys = HOME_CAPABILITIES.map((item) => item.key);
assert(new Set(keys).size === keys.length, 'Home capability keys must be unique');
assert(keys.length >= 50, 'Home capability registry is unexpectedly incomplete');

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
  'glance.precipitation',
  'glance.uv',
  'glance.bus_eta',
  'glance.safety_status',
  'now.important_message',
  'now.emergency_alert',
  'now.earthquake_alert',
  'now.tsunami_alert',
  'now.strong_wind',
  'now.snow_ice',
  'now.wildfire_alert',
  'now.river_flood_alert',
  'now.heat_cold',
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
  'today.exchange_rate',
  'today.uf',
  'today.food_prices',
  'today.fuel_nearby',
  'today.traffic_commute',
  'today.vehicle_restriction',
  'today.road_condition',
  'today.border_crossing',
  'today.maritime_forecast',
  'today.marine_alert',
  'today.tide',
  'today.daily_brief',
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

const legacyCapabilityKeys = requiredLegacyLifeCardCapabilityKeys();
assert(
  HOME_LIFE_CARD_PARITY.length >= 20,
  'Legacy life-card parity inventory is unexpectedly incomplete',
);
for (const key of legacyCapabilityKeys) {
  assert(
    homeCapability(key),
    `Legacy Base44 life-card capability missing from current Home registry: ${key}`,
  );
}

const demoKeys = requiredDemoCapabilityKeys();
assert(new Set(demoKeys).size === demoKeys.length, 'Demo capability keys must be unique');
assert(demoKeys.length >= 50, 'Complete demo must cover the functional registry');
for (const key of legacyCapabilityKeys) {
  assert(
    demoKeys.includes(key),
    `Complete demo must preserve legacy life-card capability: ${key}`,
  );
}

console.log(
  `PASS: Home capability registry (${keys.length} capabilities; ${legacyCapabilityKeys.length} legacy life-card capabilities preserved)`,
);
