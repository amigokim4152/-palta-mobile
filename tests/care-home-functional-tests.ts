import type { CareTrack } from '../src/care/careMachine.js';
import { careTrackToFunctionalHome } from '../src/home/adapters/careFunctionalAdapter.js';
import { validateHomeFunctionalItem } from '../src/home/homeFunctionalContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function project(track: CareTrack, overrides: Partial<Parameters<typeof careTrackToFunctionalHome>[0]> = {}) {
  return careTrackToFunctionalHome({
    track,
    title: 'Solicitud al taller',
    sourceDomain: 'local',
    dataMode: 'live',
    observedAt: '2026-09-18T08:00:00.000Z',
    personalized: true,
    subject: { kind: 'vehicle', id: 'vehicle-1' },
    ...overrides,
  });
}

const waiting = project({
  id: 'care-wait',
  state: 'waiting',
  waitingFor: 'respuesta del taller',
  expectedAt: '2026-09-19T15:00:00-03:00',
});
assert(waiting?.surface === 'in_progress', 'Waiting Care must project to EN CURSO.');
assert(waiting?.scheduledAt === undefined, 'Care expectedAt must never become PRÓXIMO schedule.');
assert(waiting && validateHomeFunctionalItem(waiting).length === 0, 'Waiting Care projection must satisfy Home contract.');

const result = project({
  id: 'care-result',
  state: 'result_available',
  result: {
    summary: 'Cotización disponible',
    observedAt: '2026-09-18T08:00:00.000Z',
  },
});
assert(result?.surface === 'now' && result.kind === 'action', 'Available Care result must project to AHORA.');
assert(result?.action?.target === '/care/care-result', 'Care Home action must deep-link to exact Care track.');

const confirmedUpcoming = project(
  { id: 'care-upcoming', state: 'upcoming' },
  { scheduledAt: '2026-09-20T10:30:00-03:00' },
);
assert(confirmedUpcoming?.surface === 'upcoming', 'Confirmed Care schedule must project to PRÓXIMO.');
assert(
  confirmedUpcoming?.scheduledAt === '2026-09-20T10:30:00-03:00',
  'PRÓXIMO must retain the confirmed schedule timestamp.',
);
assert(
  confirmedUpcoming && validateHomeFunctionalItem(confirmedUpcoming).length === 0,
  'Confirmed Care schedule must satisfy Home functional contract.',
);

const unconfirmedUpcoming = project({ id: 'care-unconfirmed', state: 'upcoming' });
assert(
  unconfirmedUpcoming?.surface === 'in_progress',
  'Upcoming Care without confirmed scheduledAt must remain EN CURSO, not PRÓXIMO.',
);

const blocked = project({ id: 'care-blocked', state: 'blocked' });
assert(blocked?.surface === 'now' && blocked.kind === 'alert', 'Blocked Care must surface in AHORA.');

const completed = project({ id: 'care-complete', state: 'completed' });
assert(completed === null, 'Completed Care must leave active Home.');

const outcome = project({
  id: 'care-outcome',
  state: 'outcome_recorded',
  outcome: { summary: 'Resuelto', recordedAt: '2026-09-18T08:00:00.000Z' },
});
assert(outcome === null, 'Recorded Care outcome must not remain as an active Home card.');

console.log('PASS: Care -> Home functional projection tests');
