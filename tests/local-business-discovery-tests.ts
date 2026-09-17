import {
  projectLocalBusinesses,
  LOCAL_BUSINESS_SHORTCUTS,
} from '../src/business/localBusinessDiscovery.js';
import {
  resolveBusinessOperationalState,
} from '../src/business/businessOperationalState.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const items = [
  {
    entityId: 'place-1',
    entityType: 'place' as const,
    name: 'Plaza',
    distanceM: 50,
    location: { lat: -33.4, lng: -70.6 },
  },
  {
    entityId: 'biz-open',
    entityType: 'business' as const,
    name: 'Restaurante abierto',
    distanceM: 900,
    verificationStatus: 'verified',
    operationalState: 'open_now' as const,
    location: { lat: -33.4, lng: -70.6 },
  },
  {
    entityId: 'biz-unknown',
    entityType: 'business' as const,
    name: 'Taller sin confirmar',
    distanceM: 200,
    verificationStatus: 'unverified',
    operationalState: 'unknown_or_stale' as const,
    location: { lat: -33.4, lng: -70.6 },
  },
  {
    entityId: 'biz-seasonal',
    entityType: 'business' as const,
    name: 'Restaurante de temporada',
    distanceM: 100,
    verificationStatus: 'verified',
    operationalState: 'seasonal_closed' as const,
    location: { lat: -33.4, lng: -70.6 },
  },
  {
    entityId: 'biz-gone',
    entityType: 'business' as const,
    name: 'Negocio cerrado definitivamente',
    distanceM: 20,
    verificationStatus: 'verified',
    operationalState: 'permanently_closed' as const,
    location: { lat: -33.4, lng: -70.6 },
  },
];

const projected = projectLocalBusinesses(items);
assert(projected.length === 3, 'Only ordinarily discoverable businesses should remain.');
assert(
  projected[0]?.entityId === 'biz-open',
  'A confirmed open business should rank ahead of nearer stale/closed businesses.',
);
assert(
  !projected.some((item) => item.entityId === 'biz-gone'),
  'Permanently closed businesses must not appear in ordinary discovery.',
);

const verified = projectLocalBusinesses(items, { verifiedOnly: true });
assert(
  verified.length === 2 && verified[0]?.entityId === 'biz-open',
  'Verified-only filter must remain explicit and preserve operating-state ranking.',
);

const openNow = projectLocalBusinesses(items, { openNowOnly: true });
assert(
  openNow.length === 1 && openNow[0]?.entityId === 'biz-open',
  'Open-now filter must not treat stale or seasonal-closed records as open.',
);

const ownerSeasonalClose = resolveBusinessOperationalState({
  lifecycleStatus: 'active',
  now: '2026-07-15T12:00:00-04:00',
  scheduledOpenNow: true,
  scheduleConfirmedAt: '2026-07-01T12:00:00-04:00',
  override: {
    state: 'seasonal_closed',
    source: 'owner',
    confirmedAt: '2026-07-01T12:00:00-04:00',
    effectiveFrom: '2026-05-01T00:00:00-04:00',
    effectiveUntil: '2026-09-01T00:00:00-04:00',
  },
});
assert(
  ownerSeasonalClose.state === 'seasonal_closed',
  'Seasonal owner override must beat the normal weekly schedule.',
);

const expiredTemporaryClose = resolveBusinessOperationalState({
  lifecycleStatus: 'active',
  now: '2026-09-17T12:00:00-03:00',
  scheduledOpenNow: true,
  scheduleConfirmedAt: '2026-09-10T12:00:00-03:00',
  override: {
    state: 'temporarily_closed',
    source: 'owner',
    confirmedAt: '2026-09-15T12:00:00-03:00',
    effectiveUntil: '2026-09-16T12:00:00-03:00',
  },
});
assert(
  expiredTemporaryClose.state === 'open_now',
  'Expired temporary closure must fall back to the current schedule.',
);

const staleSchedule = resolveBusinessOperationalState({
  lifecycleStatus: 'active',
  now: '2026-09-17T12:00:00-03:00',
  scheduledOpenNow: true,
  scheduleConfirmedAt: '2025-01-01T12:00:00-03:00',
  maxScheduleAgeMs: 180 * 24 * 60 * 60 * 1000,
});
assert(
  staleSchedule.state === 'unknown_or_stale',
  'Old schedule evidence must not fabricate a confident open-now claim.',
);

assert(LOCAL_BUSINESS_SHORTCUTS.length > 0, 'Discovery shortcuts should exist.');

console.log('PASS: Local Business discovery + operating-state projection');
