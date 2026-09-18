import { canRenderGlanceSignal } from '../src/home/homeCachePolicy.js';
import { mobilityToFunctionalHome } from '../src/home/adapters/mobilityFunctionalAdapter.js';
import { validateHomeFunctionalItem } from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const observedAt = '2026-09-18T12:00:00.000Z';

const verifiedBus = mobilityToFunctionalHome({
  dataMode: 'live',
  observedAt,
  expiresAt: '2026-09-18T12:02:00.000Z',
  departure: {
    routeLabel: '405',
    stopLabel: 'Av. Vitacura',
    minutes: 4,
    relevantNow: true,
    departureWindowActive: true,
    realtimeVerified: true,
  },
});
assert(verifiedBus.glance.length === 1, 'Verified relevant bus ETA should appear in Glance.');
assert(verifiedBus.glance[0]?.value === '4 min', 'Bus Glance must show the stop-arrival ETA value.');
assert(verifiedBus.items[0]?.surface === 'now', 'Imminent bus in active departure window should promote to AHORA.');
assert(validateHomeFunctionalItem(verifiedBus.items[0]!).length === 0, 'Bus action must satisfy Home contract.');

const unverifiedEta = mobilityToFunctionalHome({
  dataMode: 'scheduled',
  observedAt,
  departure: {
    routeLabel: '405',
    minutes: 6,
    relevantNow: true,
    departureWindowActive: true,
    realtimeVerified: false,
  },
});
assert(unverifiedEta.glance.length === 0 && unverifiedEta.items.length === 0, 'Unverified or route-duration-like values must never be presented as stop ETA.');

const irrelevantBus = mobilityToFunctionalHome({
  dataMode: 'live',
  observedAt,
  departure: {
    routeLabel: '405',
    minutes: 3,
    relevantNow: false,
    departureWindowActive: false,
    realtimeVerified: true,
  },
});
assert(irrelevantBus.glance.length === 0, 'Bus ETA should not become a permanent Home slot when it is not relevant now.');

const metroNormal = mobilityToFunctionalHome({
  dataMode: 'cached',
  observedAt,
  expiresAt: '2026-09-18T12:10:00.000Z',
  metro: {
    lineLabel: 'L1',
    statusLabel: 'Normal',
    relevant: true,
  },
});
assert(metroNormal.glance.length === 1, 'Relevant Metro operational state should appear in Glance.');
assert(metroNormal.items.length === 0, 'Normal Metro state should not create a large Home card.');

const metroDisruption = mobilityToFunctionalHome({
  dataMode: 'live',
  observedAt,
  expiresAt: '2026-09-18T12:05:00.000Z',
  metro: {
    lineLabel: 'L1',
    statusLabel: 'Servicio parcial',
    relevant: true,
    disrupted: true,
    disruptionSummary: 'Interrupción entre dos estaciones.',
  },
});
assert(metroDisruption.glance[0]?.exceptional === true, 'Metro disruption should mark Glance exceptional.');
assert(metroDisruption.items[0]?.surface === 'now' && metroDisruption.items[0]?.kind === 'alert', 'Relevant Metro disruption belongs in AHORA.');

const unavailable = mobilityToFunctionalHome({
  dataMode: 'unavailable',
  observedAt,
  departure: {
    routeLabel: '405',
    minutes: 2,
    relevantNow: true,
    departureWindowActive: true,
    realtimeVerified: true,
  },
  metro: {
    lineLabel: 'L1',
    statusLabel: 'Normal',
    relevant: true,
  },
});
assert(unavailable.glance.length === 0 && unavailable.items.length === 0, 'Unavailable mobility source must not fabricate or preserve current-looking values.');

assert(
  !canRenderGlanceSignal(
    verifiedBus.glance[0]!,
    new Date('2026-09-18T12:03:00.000Z'),
  ),
  'Expired stop ETA must disappear quickly.',
);

console.log('PASS: Mobility operational -> Home functional projection tests');
