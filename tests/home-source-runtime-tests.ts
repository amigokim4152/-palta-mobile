import { careToHome } from '../src/home/adapters/careHomeAdapter.js';
import { MobilityHomeAdapter } from '../src/home/adapters/mobilityHomeAdapter.js';
import { scheduledEventsToHome } from '../src/home/adapters/scheduledEventHomeAdapter.js';
import { WeatherHomeAdapter } from '../src/home/adapters/weatherHomeAdapter.js';
import { projectHomeApiItem } from '../src/home/homeApiProjection.js';
import { mergeHomeSources } from '../src/home/mergeHomeSources.js';
import type { HomeSourceContribution } from '../src/home/homeSourceContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = new Date('2026-09-18T12:00:00.000Z');

const cached: HomeSourceContribution = {
  source_domain: 'weather',
  data_mode: 'cached',
  observed_at: '2026-09-18T11:55:00.000Z',
  glance: [{ id: 'weather-current', label: 'HOY', value: '17°' }],
  items: [],
};
const live: HomeSourceContribution = {
  source_domain: 'weather',
  data_mode: 'live',
  observed_at: '2026-09-18T11:50:00.000Z',
  glance: [{ id: 'weather-current', label: 'HOY', value: '20°' }],
  items: [],
};
const expired: HomeSourceContribution = {
  source_domain: 'news',
  data_mode: 'cached',
  observed_at: '2026-09-18T09:00:00.000Z',
  expires_at: '2026-09-18T10:00:00.000Z',
  items: [
    {
      id: 'expired-news',
      kind: 'content',
      title: 'Expired',
      source_domain: 'news',
      delivery: 'home',
    },
  ],
};

const merged = mergeHomeSources([cached, live, expired], { now });
assert(merged.glance?.[0]?.value === '20°', 'Live glance data must beat cached data for the same id.');
assert(!merged.items.some((item) => item.id === 'expired-news'), 'Expired contributions must stay out of Home items.');
assert(merged.source_state?.length === 3, 'Source-state observability must retain all source states.');

const weather = new WeatherHomeAdapter().toHome({
  dataMode: 'live',
  observedAt: now.toISOString(),
  currentC: 20,
  severe: true,
  severeSummary: 'Viento fuerte',
});
assert(weather.items?.[0]?.delivery === 'home_notify', 'Severe weather should be eligible for Home notification.');
assert(weather.glance?.[0]?.exceptional === true, 'Severe weather glance must be marked exceptional.');

const mobilityUnavailable = new MobilityHomeAdapter().toHome({
  dataMode: 'unavailable',
  observedAt: now.toISOString(),
  departure: {
    routeLabel: '405',
    minutes: 2,
    relevantNow: true,
    departureWindowActive: true,
  },
});
assert(!mobilityUnavailable.glance?.length, 'Unavailable mobility source must not fabricate ETA glance data.');
assert(Boolean(mobilityUnavailable.message), 'Unavailable mobility source must expose source-state context.');

const scheduledAt = '2026-09-18T13:00:00.000Z';
const scheduled = scheduledEventsToHome(
  {
    sourceDomain: 'public-life',
    dataMode: 'scheduled',
    observedAt: now.toISOString(),
    events: [
      {
        id: 'confirmed-deadline',
        title: 'Trámite municipal',
        scheduledAt,
        confirmed: true,
        actionRequired: true,
        attentionLeadMinutes: 120,
        actionLabel: 'Ver requisitos',
        actionTarget: 'https://example.invalid/requisitos',
        actionKind: 'external',
      },
      {
        id: 'unconfirmed',
        title: 'No confirmado',
        scheduledAt,
        confirmed: false,
      },
    ],
  },
  now,
);
assert(scheduled.items?.length === 1, 'Only confirmed scheduled events may enter Home.');
const scheduledItem = scheduled.items?.[0];
assert(scheduledItem, 'Expected a confirmed scheduled Home item.');
assert(scheduledItem.scheduled_at === scheduledAt, 'Confirmed schedule must preserve scheduled_at.');
assert(scheduledItem.delivery === 'home_notify', 'Near-term required action should escalate to home_notify.');

const projected = projectHomeApiItem(scheduledItem);
assert(projected.domain === 'public-life', 'Home projection must preserve known source domain.');
assert(projected.action?.kind === 'external', 'Generic external action target must survive Home projection.');

const careWaiting = careToHome({
  track: {
    id: 'care-waiting',
    intent_key: 'municipal-request',
    state: 'wait',
    expected_at: '2026-09-20T12:00:00.000Z',
  },
  title: 'Solicitud enviada',
  observedAt: now.toISOString(),
});
const waitingItem = careWaiting.items?.[0];
assert(waitingItem?.kind === 'status', 'Care wait state must remain a status.');
assert(waitingItem.scheduled_at === undefined, 'Expected response time must not be fabricated as a scheduled appointment.');

console.log('PASS: Home source runtime tests');
