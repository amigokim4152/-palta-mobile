import {
  scheduledEventsToFunctionalHome,
  type ScheduledFunctionalEvent,
} from '../src/home/adapters/scheduledFunctionalAdapter.js';
import { validateHomeFunctionalItem } from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = new Date('2026-09-18T12:00:00.000Z');

const events: ScheduledFunctionalEvent[] = [
  {
    id: 'medical-1',
    title: 'Consulta médica',
    scheduledAt: '2026-09-20T13:30:00.000Z',
    confirmed: true,
    personalized: true,
    subject: { kind: 'person', id: 'person-1' },
    action: {
      label: 'Ver detalle',
      kind: 'internal',
      target: '/care/medical-1',
    },
  },
  {
    id: 'school-unconfirmed',
    title: 'Actividad del colegio',
    scheduledAt: '2026-09-19T13:00:00.000Z',
    confirmed: false,
  },
  {
    id: 'vehicle-soon',
    title: 'Revisión técnica',
    scheduledAt: '2026-09-18T13:00:00.000Z',
    confirmed: true,
    actionRequired: true,
    attentionLeadMinutes: 120,
    personalized: true,
    subject: { kind: 'vehicle', id: 'vehicle-1' },
  },
];

const projected = scheduledEventsToFunctionalHome(
  {
    sourceDomain: 'schedule',
    dataMode: 'scheduled',
    observedAt: '2026-09-18T11:55:00.000Z',
    events,
  },
  now,
);

assert(projected.length === 2, 'Only confirmed valid schedules should be projected.');
const vehicle = projected.find((item) => item.id.endsWith('vehicle-soon'));
const medical = projected.find((item) => item.id.endsWith('medical-1'));
assert(vehicle?.surface === 'now', 'Imminent schedule requiring action must promote to AHORA.');
assert(vehicle?.kind === 'action', 'Imminent required preparation must be actionable.');
assert(vehicle?.scheduledAt === '2026-09-18T13:00:00.000Z', 'Promoted AHORA item must retain schedule context.');
assert(medical?.surface === 'upcoming', 'Confirmed future schedule should remain PRÓXIMO.');
assert(medical?.kind === 'status', 'Future schedule without immediate action should be status.');
assert(projected.every((item) => validateHomeFunctionalItem(item).length === 0), 'Projected schedules must satisfy Home functional contract.');

const invalidAndFar = scheduledEventsToFunctionalHome(
  {
    sourceDomain: 'school',
    dataMode: 'scheduled',
    observedAt: now.toISOString(),
    maxFutureDays: 30,
    events: [
      {
        id: 'invalid',
        title: 'Invalid date',
        scheduledAt: 'not-a-date',
        confirmed: true,
      },
      {
        id: 'far',
        title: 'Too far away',
        scheduledAt: '2027-01-01T12:00:00.000Z',
        confirmed: true,
      },
      {
        id: 'too-old',
        title: 'Old appointment',
        scheduledAt: '2026-09-18T09:00:00.000Z',
        confirmed: true,
      },
    ],
  },
  now,
);
assert(invalidAndFar.length === 0, 'Invalid, distant and sufficiently past schedules must stay out of Home.');

const sorted = scheduledEventsToFunctionalHome(
  {
    sourceDomain: 'school',
    dataMode: 'scheduled',
    observedAt: now.toISOString(),
    events: [
      { id: 'later', title: 'Later', scheduledAt: '2026-09-20T12:00:00.000Z', confirmed: true },
      { id: 'earlier', title: 'Earlier', scheduledAt: '2026-09-19T12:00:00.000Z', confirmed: true },
    ],
  },
  now,
);
assert(sorted[0]?.id.endsWith('earlier') && sorted[1]?.id.endsWith('later'), 'PRÓXIMO schedules must sort chronologically.');

console.log('PASS: Scheduled event -> Home functional projection tests');
