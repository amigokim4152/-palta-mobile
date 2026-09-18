import {
  canRenderHomeFunctionalItem,
  validateHomeFunctionalItem,
  validateHomeFunctionalPayload,
  type HomeFunctionalItem,
  type HomeFunctionalPayload,
} from '../src/home/homeFunctionalContract.js';
import {
  homeContextCreatesDurableLocationFact,
  resolveHomeContext,
} from '../src/home/homeContextResolver.js';
import {
  createHomeCorrectionIntent,
  shouldSuppressImmediately,
} from '../src/home/homeCorrection.js';
import {
  markNotificationRead,
  summarizeNotificationInbox,
  validateNotificationInboxItem,
  type NotificationInboxItem,
} from '../src/notification/inboxModel.js';

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

const { action: _action, ...withoutAction } = validUpcoming;
const fakeAction: HomeFunctionalItem = {
  ...withoutAction,
  id: 'fake-action',
};
assert(
  validateHomeFunctionalItem(fakeAction).some((error) => error.includes('executable action target')),
  'Action cards must not exist without a real executable target.',
);

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
      changeTarget: '/context/location',
    },
    notificationsTarget: '/context/notifications',
    unreadNotificationCount: 0,
    profileTarget: '/context/profile',
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

const resolvedHome = resolveHomeContext({
  profile: { preferredName: 'Ana' },
  locations: {
    currentLocation: { id: 'gps-centro', label: 'Santiago Centro' },
    homeArea: { id: 'home-vitacura', label: 'Vitacura', comuna: 'Vitacura' },
    savedPlaces: [],
  },
  unreadNotificationCount: 3,
});
assert(resolvedHome.locality.label === 'Vitacura', 'Home area should be the default durable Home locality.');
assert(resolvedHome.localitySource === 'home_area', 'Home context must expose why locality was selected.');
assert(resolvedHome.unreadNotificationCount === 3, 'Home context must carry unread notification count.');
assert(resolvedHome.profileLabel === 'Ana', 'Home context may use lightweight Core Profile presentation data.');
assert(homeContextCreatesDurableLocationFact(resolvedHome), 'Confirmed home area is a durable location fact.');

const gpsContext = resolveHomeContext({
  locations: {
    currentLocation: { id: 'gps-centro', label: 'Santiago Centro' },
    savedPlaces: [],
  },
  explicitLocalityId: 'gps-centro',
});
assert(gpsContext.localitySource === 'explicit', 'Explicit locality override should win for the active Home context.');
assert(!homeContextCreatesDurableLocationFact(gpsContext), 'Explicit/current context must not silently become home data.');

const alreadyDone = createHomeCorrectionIntent({
  item: validUpcoming,
  reason: 'already_done',
  now: new Date('2026-09-18T08:00:00.000Z'),
  intentId: 'correction-1',
});
assert(alreadyDone.effect === 'reconcile_domain_completion', 'Already-done correction must reconcile with the owning domain.');
assert(!shouldSuppressImmediately(alreadyDone), 'Already-done must not silently fabricate domain completion.');

let disallowedCorrectionRejected = false;
try {
  createHomeCorrectionIntent({ item: validUpcoming, reason: 'hide_type' });
} catch {
  disallowedCorrectionRejected = true;
}
assert(disallowedCorrectionRejected, 'Home must reject correction reasons not offered by the item.');

const hideable: HomeFunctionalItem = {
  ...validUpcoming,
  id: 'local-news-1',
  surface: 'useful_today',
  kind: 'content',
  corrections: ['not_relevant', 'hide_type'],
  source: { domain: 'news', mode: 'cached' },
};
const hideType = createHomeCorrectionIntent({
  item: hideable,
  reason: 'hide_type',
  intentId: 'correction-2',
});
assert(shouldSuppressImmediately(hideType), 'Hide-type feedback may suppress presentation immediately.');

const notifications: NotificationInboxItem[] = [
  {
    id: 'n1',
    title: 'Respuesta recibida',
    sourceDomain: 'local',
    createdAt: '2026-09-18T07:00:00.000Z',
    importance: 'important',
    target: '/care/care-1',
  },
  {
    id: 'n2',
    title: 'Alerta importante',
    sourceDomain: 'public-life',
    createdAt: '2026-09-18T08:00:00.000Z',
    importance: 'urgent',
    target: '/care/care-2',
  },
];
assert(validateNotificationInboxItem(notifications[0]!).length === 0, 'Valid notification should pass validation.');
const inbox = summarizeNotificationInbox(notifications);
assert(inbox.unreadCount === 2, 'Home must receive total unread notification count.');
assert(inbox.importantUnreadCount === 1 && inbox.urgentUnreadCount === 1, 'Inbox summary must retain urgency levels.');
assert(inbox.latestUnreadAt === '2026-09-18T08:00:00.000Z', 'Inbox summary should expose latest unread timestamp.');
const readFirst = markNotificationRead(notifications[0]!, '2026-09-18T08:10:00.000Z');
const afterRead = summarizeNotificationInbox([readFirst, notifications[1]!]);
assert(afterRead.unreadCount === 1, 'Reading a notification must update Home unread count deterministically.');

console.log('PASS: Home functional contract tests');
