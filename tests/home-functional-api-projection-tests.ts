import { projectFunctionalHomeToApi } from '../src/home/homeFunctionalApiProjection.js';
import type { HomeFunctionalPayload } from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const payload: HomeFunctionalPayload = {
  generatedAt: '2026-09-18T12:00:00.000Z',
  context: {
    locality: {
      id: 'vitacura',
      label: 'Vitacura',
      changeTarget: '/context/location',
    },
    notificationsTarget: '/context/notifications',
    unreadNotificationCount: 2,
    profileTarget: '/context/profile',
  },
  glance: [
    {
      id: 'weather',
      label: 'CLIMA',
      value: '18°',
      detail: '10° / 24°',
      relevance: 0.8,
      source: {
        domain: 'weather',
        mode: 'live',
        observedAt: '2026-09-18T11:55:00.000Z',
        expiresAt: '2026-09-18T12:10:00.000Z',
      },
    },
  ],
  now: [
    {
      id: 'care-result',
      surface: 'now',
      kind: 'action',
      title: 'Hay una respuesta a tu solicitud',
      personalized: true,
      subject: { kind: 'vehicle', id: 'vehicle-1' },
      corrections: ['already_done', 'incorrect_information'],
      action: {
        label: 'Ver seguimiento',
        kind: 'internal',
        target: '/care/care-123',
      },
      source: {
        domain: 'local_business',
        mode: 'live',
        observedAt: '2026-09-18T11:58:00.000Z',
      },
      dedupeKey: 'quote-123',
      urgency: 3,
      importance: 3,
      relevance: 1,
    },
  ],
  inProgress: [],
  upcoming: [
    {
      id: 'appointment-1',
      surface: 'upcoming',
      kind: 'status',
      title: 'Consulta médica',
      scheduledAt: '2026-09-20T10:30:00-03:00',
      source: { domain: 'health', mode: 'scheduled' },
    },
  ],
  usefulToday: [
    {
      id: 'benefit-1',
      surface: 'useful_today',
      kind: 'useful',
      title: 'Beneficio municipal vigente',
      source: { domain: 'public-life', mode: 'cached' },
    },
  ],
};

const api = projectFunctionalHomeToApi(payload);
assert(api.contract_version === 'functional-home-v1', 'API response must advertise the functional Home contract.');
assert(api.locality_label === 'Vitacura', 'Legacy locality label must remain available during migration.');
assert(api.context?.locality.change_target === '/context/location', 'API must expose locality correction target.');
assert(api.context?.unread_notification_count === 2, 'API must expose unread notification count.');
assert(api.glance?.[0]?.source_domain === 'weather', 'Glance source metadata must survive API projection.');
assert(api.items.length === 3, 'All semantic Home sections must flatten into backward-compatible items[].');

const care = api.items.find((item) => item.id === 'care-result');
assert(care?.surface === 'now', 'Functional surface must survive API projection.');
assert(care?.action_target === '/care/care-123', 'Exact action target must survive API projection.');
assert(care?.care_track_id === 'care-123', 'Legacy care_track_id must derive from exact Care action target regardless of source domain.');
assert(care?.related_entity_id === 'vehicle-1', 'Legacy related entity ID must remain available.');
assert(care?.dedupe_key === 'quote-123', 'Dedupe identity must survive the API boundary.');
assert(care?.urgency === 3 && care.importance === 3 && care.relevance === 1, 'Ranking metadata must survive the API boundary.');

const upcoming = api.items.find((item) => item.id === 'appointment-1');
assert(upcoming?.surface === 'upcoming', 'PRÓXIMO item must preserve semantic surface.');
assert(upcoming?.scheduled_at === '2026-09-20T10:30:00-03:00', 'Confirmed schedule timestamp must survive API projection.');

const benefit = api.items.find((item) => item.id === 'benefit-1');
assert(benefit?.kind === 'useful_today', 'Functional useful kind must map to legacy-compatible useful_today API kind.');

console.log('PASS: Functional Home -> API projection tests');
