import { composeFunctionalHome } from '../src/home/functionalHomeComposer.js';
import type {
  HomeContext,
  HomeFunctionalItem,
  HomeGlanceSignal,
} from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const context: HomeContext = {
  locality: { id: 'vitacura', label: 'Vitacura', changeTarget: '/context/location' },
  notificationsTarget: '/context/notifications',
  profileTarget: '/context/profile',
};
const now = new Date('2026-09-18T12:00:00.000Z');

function item(
  id: string,
  overrides: Partial<HomeFunctionalItem> = {},
): HomeFunctionalItem {
  return {
    id,
    surface: 'in_progress',
    kind: 'status',
    title: id,
    source: { domain: 'test', mode: 'live', observedAt: now.toISOString() },
    ...overrides,
  };
}

// Same real-world event from multiple sources should resolve to the stronger semantic item.
const deduped = composeFunctionalHome({
  generatedAt: now.toISOString(),
  context,
  contributions: [
    {
      items: [
        item('duplicate-content', {
          surface: 'useful_today',
          kind: 'content',
          dedupeKey: 'event-1',
          relevance: 0.8,
        }),
        item('duplicate-alert', {
          surface: 'now',
          kind: 'alert',
          dedupeKey: 'event-1',
          urgency: 3,
        }),
      ],
    },
  ],
  options: { now },
});
assert(deduped.now.length === 1 && deduped.now[0]?.id === 'duplicate-alert', 'Dedupe must keep the stronger real-world representation.');
assert(deduped.usefulToday.length === 0, 'Dedupe must not leave the weaker duplicate behind.');

// NOW uses urgency/importance/relevance instead of domain-specific fixed ordering.
const ranked = composeFunctionalHome({
  generatedAt: now.toISOString(),
  context,
  contributions: [
    {
      items: [
        item('low', { surface: 'now', kind: 'alert', urgency: 1, importance: 1 }),
        item('high', { surface: 'now', kind: 'alert', urgency: 4, importance: 4 }),
      ],
    },
  ],
  options: { now },
});
assert(ranked.now[0]?.id === 'high', 'Higher urgency/importance item must rank first in AHORA.');

// Upcoming schedules retain chronological ordering.
const upcoming = composeFunctionalHome({
  generatedAt: now.toISOString(),
  context,
  contributions: [
    {
      items: [
        item('later', {
          surface: 'upcoming',
          scheduledAt: '2026-09-20T12:00:00.000Z',
        }),
        item('earlier', {
          surface: 'upcoming',
          scheduledAt: '2026-09-19T12:00:00.000Z',
        }),
      ],
    },
  ],
  options: { now },
});
assert(upcoming.upcoming[0]?.id === 'earlier', 'PRÓXIMO must remain chronological.');

// Busy Home suppresses generic content before useful operational information.
const busyItems: HomeFunctionalItem[] = [
  item('now-1', { surface: 'now', kind: 'alert' }),
  item('now-2', { surface: 'now', kind: 'alert' }),
  item('progress-1'),
  item('progress-2'),
  item('progress-3'),
  item('benefit', { surface: 'useful_today', kind: 'useful', importance: 3 }),
  item('news-1', { surface: 'useful_today', kind: 'content', relevance: 1 }),
  item('news-2', { surface: 'useful_today', kind: 'content', relevance: 0.9 }),
];
const busy = composeFunctionalHome({
  generatedAt: now.toISOString(),
  context,
  contributions: [{ items: busyItems }],
  options: { now },
});
assert(busy.now.length + busy.inProgress.length + busy.upcoming.length >= 5, 'Test Home should be busy.');
assert(busy.usefulToday.some((entry) => entry.id === 'benefit'), 'Useful public-life information may remain on a busy Home.');
assert(busy.usefulToday.filter((entry) => entry.kind === 'content').length <= 1, 'Busy Home must suppress most generic content/news.');

// Sparse Home may show relevant content and still declare the calm state.
const sparse = composeFunctionalHome({
  generatedAt: now.toISOString(),
  context,
  contributions: [
    {
      items: [item('local-news', { surface: 'useful_today', kind: 'content', relevance: 0.9 })],
    },
  ],
  options: { now },
});
assert(sparse.quietState?.title === 'Nada urgente por ahora', 'No active life state should produce a calm Home state.');
assert(sparse.usefulToday.length === 1, 'Quiet Home may still show genuinely relevant today content.');

// Expired items and unavailable/expired Glance signals must not survive composition.
const glanceSignals: HomeGlanceSignal[] = [
  {
    id: 'weather',
    label: 'CLIMA',
    value: '18°',
    relevance: 0.8,
    source: {
      domain: 'weather',
      mode: 'cached',
      observedAt: '2026-09-18T11:50:00.000Z',
      expiresAt: '2026-09-18T12:10:00.000Z',
    },
  },
  {
    id: 'bus',
    label: 'BUS',
    value: '4 min',
    source: {
      domain: 'mobility',
      mode: 'live',
      expiresAt: '2026-09-18T11:59:00.000Z',
    },
  },
  {
    id: 'metro',
    label: 'METRO',
    value: 'Normal',
    source: { domain: 'mobility', mode: 'unavailable' },
  },
];
const freshness = composeFunctionalHome({
  generatedAt: now.toISOString(),
  context,
  contributions: [
    {
      glance: glanceSignals,
      items: [
        item('expired-item', {
          source: {
            domain: 'public-life',
            mode: 'cached',
            expiresAt: '2026-09-18T11:59:00.000Z',
          },
        }),
      ],
    },
  ],
  options: { now },
});
assert(freshness.glance.length === 1 && freshness.glance[0]?.id === 'weather', 'Only current Glance signals should survive composition.');
assert(freshness.inProgress.length === 0, 'Expired Home items must be removed during composition.');

// Glance is bounded and exceptional/relevant signals sort first.
const glanceBounded = composeFunctionalHome({
  generatedAt: now.toISOString(),
  context,
  contributions: [
    {
      glance: Array.from({ length: 6 }, (_, index): HomeGlanceSignal => ({
        id: `g-${index}`,
        label: `G${index}`,
        value: String(index),
        exceptional: index === 5,
        relevance: index / 10,
        source: { domain: 'test', mode: 'live' },
      })),
    },
  ],
  options: { now, maxGlance: 4 },
});
assert(glanceBounded.glance.length === 4, 'Glance must respect its density cap.');
assert(glanceBounded.glance[0]?.id === 'g-5', 'Exceptional Glance signal must sort first.');

// Explicit, privacy-minimized behavior may reorder equally useful passive cards.
const behaviorRanked = composeFunctionalHome({
  generatedAt: now.toISOString(),
  context,
  contributions: [
    {
      items: [
        item('generic-panorama', {
          capabilityKey: 'today.panorama.generic',
          surface: 'useful_today',
          kind: 'content',
          source: { domain: 'play', mode: 'live' },
          relevance: 0.75,
        }),
        item('preferred-panorama', {
          capabilityKey: 'today.panorama.preferred',
          surface: 'useful_today',
          kind: 'content',
          source: { domain: 'play', mode: 'live' },
          relevance: 0.75,
        }),
      ],
    },
  ],
  options: {
    now,
    behaviorProfile: {
      aggregates: [
        {
          dimension: 'capability',
          key: 'today.panorama.preferred',
          usefulConfirmedCount: 8,
        },
      ],
    },
  },
});
assert(
  behaviorRanked.usefulToday[0]?.id === 'preferred-panorama',
  'Explicit behavior aggregate should fine-tune passive useful-today ordering',
);

// Explicit suppression may remove passive content, but never a required alert/action.
const behaviorSuppression = composeFunctionalHome({
  generatedAt: now.toISOString(),
  context,
  contributions: [
    {
      items: [
        item('suppressed-content', {
          capabilityKey: 'today.local_service_change',
          surface: 'useful_today',
          kind: 'content',
          source: { domain: 'public-life', mode: 'live' },
        }),
        item('protected-alert', {
          capabilityKey: 'today.local_service_change',
          surface: 'now',
          kind: 'alert',
          source: { domain: 'public-life', mode: 'live' },
          urgency: 4,
          importance: 4,
        }),
      ],
    },
  ],
  options: {
    now,
    behaviorProfile: {
      aggregates: [
        {
          dimension: 'capability',
          key: 'today.local_service_change',
          explicitSuppression: true,
        },
      ],
    },
  },
});
assert(
  behaviorSuppression.usefulToday.length === 0,
  'Explicit suppression should remove matching passive content',
);
assert(
  behaviorSuppression.now[0]?.id === 'protected-alert',
  'Behavior learning must never suppress required alert state',
);

console.log('PASS: Functional Home composer tests');
