import {
  HOME_CAPABILITIES,
  homeCapability,
  requiredDemoCapabilityKeys,
} from '../src/home/homeCapabilityRegistry.js';
import {
  HOME_LIFE_CARD_PARITY,
  requiredLegacyLifeCardCapabilityKeys,
} from '../src/home/homeLifeCardParity.js';
import {
  eligibleLifeCardDefinitions,
  isLifeCardGeoScopeEligible,
} from '../src/home/homeLifeCardEligibility.js';
import {
  HOME_ENTRY_CAPABILITIES,
  requiredHomeEntryCapabilityKeys,
} from '../src/home/homeEntryCapabilityParity.js';

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
  'today.palta_notice',
  'today.local_news',
  'today.exchange_rate',
  'today.uf',
  'today.food_prices',
  'today.nearby_food_available',
  'today.fuel_nearby',
  'today.traffic_commute',
  'today.vehicle_restriction',
  'today.road_condition',
  'today.border_crossing',
  'today.maritime_forecast',
  'today.marine_alert',
  'today.tide',
  'today.daily_brief',
  'today.chile_annual_rhythm',
  'today.interest_personalization',
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
for (const key of ['today.interest_personalization', 'today.palta_notice', 'today.nearby_food_available']) {
  assert(demoKeys.includes(key), `Complete demo must preserve Home capability: ${key}`);
}

for (const definition of HOME_LIFE_CARD_PARITY) {
  assert(
    isLifeCardGeoScopeEligible(definition.geoScope, { mode: 'complete_demo' }),
    `Complete demo must show life-card capability regardless of geography: ${definition.capabilityKey}`,
  );
}

const entryKeys = requiredHomeEntryCapabilityKeys();
assert(HOME_ENTRY_CAPABILITIES.length >= 19, 'Legacy Home entry capability inventory is unexpectedly incomplete');
assert(new Set(entryKeys).size === entryKeys.length, 'Home entry capability keys must be unique');
for (const key of [
  'entry.search',
  'entry.nearby',
  'entry.local_business',
  'entry.real_estate',
  'entry.community',
  'entry.map',
  'entry.health',
  'entry.pets',
  'entry.education',
  'entry.marketplace',
  'entry.jobs',
  'entry.food',
  'entry.events',
  'entry.exchange',
  'entry.interests',
  'entry.kids',
  'entry.services',
  'entry.notices',
  'entry.more',
]) {
  assert(entryKeys.includes(key), `Legacy Base44 Home entry capability missing: ${key}`);
}

const santiagoKeys = new Set(
  eligibleLifeCardDefinitions(HOME_LIFE_CARD_PARITY, {
    localityKey: 'vitacura',
    traits: ['urban_metro'],
    mode: 'production',
  }).map((definition) => definition.capabilityKey),
);
assert(santiagoKeys.has('today.vehicle_restriction'), 'RM should allow vehicle restriction capability');
assert(!santiagoKeys.has('today.marine_alert'), 'RM inland Home must not surface marine alerts by geography alone');
assert(!santiagoKeys.has('today.border_crossing'), 'RM inland Home must not surface border crossing by geography alone');

const coastalKeys = new Set(
  eligibleLifeCardDefinitions(HOME_LIFE_CARD_PARITY, {
    localityKey: 'valparaiso',
    traits: ['coastal', 'urban'],
    mode: 'production',
  }).map((definition) => definition.capabilityKey),
);
assert(coastalKeys.has('today.maritime_forecast'), 'Coastal Home should allow maritime forecast');
assert(coastalKeys.has('today.marine_alert'), 'Coastal Home should allow marine alerts');
assert(coastalKeys.has('today.tide'), 'Coastal Home should allow tide context');
assert(coastalKeys.has('now.tsunami_alert'), 'Coastal Home should allow tsunami alert capability');
assert(!coastalKeys.has('today.border_crossing'), 'Coastal-only context must not imply border crossing');

const borderMountainKeys = new Set(
  eligibleLifeCardDefinitions(HOME_LIFE_CARD_PARITY, {
    localityKey: 'los-andes',
    traits: ['inland', 'border', 'foothill'],
    mode: 'production',
  }).map((definition) => definition.capabilityKey),
);
assert(borderMountainKeys.has('today.border_crossing'), 'Border locality should allow border crossing');
assert(borderMountainKeys.has('today.road_condition'), 'Foothill locality should allow mountain road condition');
assert(borderMountainKeys.has('now.snow_ice'), 'Foothill locality should allow snow/ice warnings');
assert(!borderMountainKeys.has('today.marine_alert'), 'Inland border locality must not surface marine alerts');

console.log(
  `PASS: Home capability registry (${keys.length} capabilities; ${legacyCapabilityKeys.length} legacy life-card capabilities; ${entryKeys.length} entry capabilities preserved)`,
);
