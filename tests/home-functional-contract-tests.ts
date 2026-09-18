import {
  canRenderHomeFunctionalItem,
  validateHomeFunctionalItem,
  validateHomeFunctionalPayload,
  type HomeFunctionalItem,
  type HomeFunctionalPayload,
} from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const validUpcoming: HomeFunctionalItem = {
  id: 'appointment-1',
  surface: 'upcoming',
  kind: 'action',
  title: 'Consulta médica',
  scheduledAt: '2026-09-20T10:30:00-03:00',
  personalized: true,
  subject: { kind: 'person', id: 'person-1' },
  corrections: ['wrong_subject', 'already_done', 'incorrect_information'],
  action: {
    label: 'Ver detalle',
    kind: 'internal',
    target: '/care/appointment-1',
  },
  source: {
    domain: 'health',
    mode: 'scheduled',
    observedAt: '2026-09-18T04:00:00-03:00',
  },
};

assert(validateHomeFunctionalItem(validUpcoming).length === 0, 'Valid upcoming item should pass.');
assert(canRenderHomeFunctionalItem(validUpcoming), 'Valid upcoming item should render.');

const { scheduledAt: _scheduledAt, ...withoutSchedule } = validUpcoming;
const missingSchedule: HomeFunctionalItem = {
  ...withoutSchedule,
  id: 'appointment-missing-time',
};
assert(
  validateHomeFunctionalItem(missingSchedule).some((error) => error.includes('scheduledAt')),
  'PRÓXIMO item must require a confirmed schedule.',
);

const unavailable: HomeFunctionalItem = {
  ...validUpcoming,
  id: 'unavailable-source',
  source: { domain: 'mobility', mode: 'unavailable' },
};
assert(!canRenderHomeFunctionalItem(unavailable), 'Unavailable source must not render as a Home item.');

const noCorrection: HomeFunctionalItem = {
  ...validUpcoming,
  id: 'no-correction',
  corrections: [],
};
assert(
  validateHomeFunctionalItem(noCorrection).some((error) => error.includes('correction')),
  'Personalized Home items must provide a correction path.',
);

const expired: HomeFunctionalItem = {
  ...validUpcoming,
  id: 'expired',
  source: {
    domain: 'public-life',
    mode: 'cached',
    expiresAt: '2026-09-17T23:00:00-03:00',
  },
};
assert(
  !canRenderHomeFunctionalItem(expired, new Date('2026-09-18T04:00:00-03:00')),
  'Expired Home items must not render.',
);

const payload: HomeFunctionalPayload = {
  generatedAt: '2026-09-18T04:00:00-03:00',
  context: {
    locality: {
      id: 'vitacura',
      label: 'Vitacura',
      changeTarget: '/location',
    },
    notificationsTarget: '/notifications',
    unreadNotificationCount: 0,
    profileTarget: '/profile',
  },
  glance: [
    {
      id: 'weather',
      label: 'CLIMA',
      value: '12°',
      source: { domain: 'weather', mode: 'live' },
    },
  ],
  now: [],
  inProgress: [],
  upcoming: [validUpcoming],
  usefulToday: [],
  quietState: { title: 'Nada urgente por ahora' },
};

assert(validateHomeFunctionalPayload(payload).length === 0, 'Valid Home payload should pass.');

const wrongSection: HomeFunctionalPayload = {
  ...payload,
  upcoming: [],
  now: [validUpcoming],
};
assert(
  validateHomeFunctionalPayload(wrongSection).some((error) => error.includes('does not match now')),
  'An item must not silently appear in the wrong semantic Home section.',
);

console.log('PASS: Home functional contract tests');
