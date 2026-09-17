import { refreshBusinessOperationalState } from './operating-rules-state.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const seeded = { id: 'biz-taller-1' };

const morning = refreshBusinessOperationalState(
  seeded,
  new Date('2026-09-17T10:00:00-03:00'),
);
assert(
  morning.operational_state === 'open_now',
  'Seeded weekly rules should project open_now during configured hours.',
);

const evening = refreshBusinessOperationalState(
  seeded,
  new Date('2026-09-17T19:00:00-03:00'),
);
assert(
  evening.operational_state === 'closed_now',
  'The same stored rules must project closed_now later without another owner mutation.',
);

const unknownBusiness = { id: 'biz-without-hours' };
const unknown = refreshBusinessOperationalState(
  unknownBusiness,
  new Date('2026-09-17T10:00:00-03:00'),
);
assert(
  unknown.operational_state === 'unknown_or_stale',
  'A Business with no configured schedule must not be presented as closed_today.',
);
assert(
  unknownBusiness.opening_status === 'Horario por confirmar',
  'A Business with no configured schedule should expose a clear confirmation-needed label.',
);

console.log('PASS: mock Business operating state is recalculated at read time');
