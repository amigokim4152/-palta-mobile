import assert from 'node:assert/strict';
import {
  HOME_CAPABILITIES,
  homeCapability,
  requiredDemoCapabilityKeys,
} from '../src/home/homeCapabilityRegistry.js';

const keys = HOME_CAPABILITIES.map((item) => item.key);
assert.equal(new Set(keys).size, keys.length, 'Home capability keys must be unique');
assert.ok(keys.length >= 35, 'Home capability registry is unexpectedly incomplete');

const requiredSurfaces = new Set([
  'context',
  'glance',
  'now',
  'in_progress',
  'upcoming',
  'useful_today',
]);
for (const surface of requiredSurfaces) {
  assert.ok(
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
  'today.followed_business_update',
  'today.jobs_nearby',
  'today.property_saved_change',
]) {
  assert.ok(homeCapability(key), `Required Home capability missing: ${key}`);
}

const demoKeys = requiredDemoCapabilityKeys();
assert.equal(new Set(demoKeys).size, demoKeys.length, 'Demo capability keys must be unique');
assert.ok(demoKeys.length >= 35, 'Complete demo must cover the functional registry');

console.log(`PASS: Home capability registry (${keys.length} capabilities)`);
