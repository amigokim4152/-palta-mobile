import {
  canRenderGlanceSignal,
  decideHomeStartup,
  renderableGlanceSignals,
  type HomeSnapshot,
} from '../src/home/homeCachePolicy.js';
import type { HomeFunctionalPayload } from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const payload: HomeFunctionalPayload = {
  generatedAt: '2026-09-18T08:00:00.000Z',
  context: {
    locality: { id: 'vitacura', label: 'Vitacura', changeTarget: '/context/location' },
    notificationsTarget: '/context/notifications',
    profileTarget: '/context/profile',
  },
  glance: [
    {
      id: 'weather-fresh',
      label: 'CLIMA',
      value: '12°',
      source: {
        domain: 'weather',
        mode: 'cached',
        expiresAt: '2026-09-18T08:20:00.000Z',
      },
    },
    {
      id: 'bus-expired',
      label: 'BUS',
      value: '4 min',
      source: {
        domain: 'mobility',
        mode: 'live',
        expiresAt: '2026-09-18T07:59:00.000Z',
      },
    },
  ],
  now: [],
  inProgress: [],
  upcoming: [],
  usefulToday: [],
  quietState: { title: 'Nada urgente por ahora' },
};

const snapshot: HomeSnapshot = {
  payload,
  storedAt: '2026-09-18T08:00:00.000Z',
  refreshAfter: '2026-09-18T08:05:00.000Z',
};

const fresh = decideHomeStartup({
  snapshot,
  connectivity: 'online',
  now: new Date('2026-09-18T08:03:00.000Z'),
});
assert(fresh.cacheState === 'fresh', 'Fresh cached Home should render immediately.');
assert(fresh.payload === payload, 'Fresh cached Home should retain the cached payload.');
assert(!fresh.shouldRefresh, 'Fresh cache should not force an immediate refresh.');

const staleOnline = decideHomeStartup({
  snapshot,
  connectivity: 'online',
  now: new Date('2026-09-18T08:10:00.000Z'),
});
assert(staleOnline.cacheState === 'stale', 'Stale Home should remain renderable.');
assert(staleOnline.shouldRefresh, 'Stale Home should refresh in the background while online.');

const staleOffline = decideHomeStartup({
  snapshot,
  connectivity: 'offline',
  now: new Date('2026-09-18T08:10:00.000Z'),
});
assert(staleOffline.cacheState === 'stale', 'Offline Home should keep the last known snapshot.');
assert(staleOffline.payload === payload, 'Offline mode must not discard the last known Home.');
assert(!staleOffline.shouldRefresh, 'Offline mode cannot attempt network refresh.');

const noCacheOffline = decideHomeStartup({ connectivity: 'offline' });
assert(noCacheOffline.payload === null, 'No cache means no fabricated Home while offline.');
assert(!noCacheOffline.shouldRefresh, 'No network means no refresh attempt.');

assert(
  canRenderGlanceSignal(payload.glance[0]!, new Date('2026-09-18T08:10:00.000Z')),
  'Fresh cached weather may remain visible.',
);
assert(
  !canRenderGlanceSignal(payload.glance[1]!, new Date('2026-09-18T08:10:00.000Z')),
  'Expired realtime bus ETA must not be shown as current.',
);
const visibleGlance = renderableGlanceSignals(payload, new Date('2026-09-18T08:10:00.000Z'));
assert(visibleGlance.length === 1 && visibleGlance[0]?.id === 'weather-fresh', 'Expired realtime Glance signals must be removed independently of cached Home.');

console.log('PASS: Home cache/offline policy tests');
