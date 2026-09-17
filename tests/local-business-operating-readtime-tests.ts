import {
  businessOperatingRulesToOperationalInput,
  projectBusinessOperatingRules,
  type BusinessLocalClockSnapshot,
  type BusinessOperatingRules,
} from '../src/business/businessOperatingRules.js';
import { resolveBusinessOperationalState } from '../src/business/businessOperationalState.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const rules: BusinessOperatingRules = {
  timezone: 'America/Santiago',
  confirmedAt: '2026-09-01T12:00:00Z',
  weekly: {
    thursday: [{ opensAt: '09:00', closesAt: '18:00' }],
  },
};

function snapshot(instant: string, localTime: string): BusinessLocalClockSnapshot {
  return {
    instant,
    timezone: 'America/Santiago',
    localDate: '2026-09-17',
    localTime,
    weekday: 'thursday',
  };
}

function stateAt(clock: BusinessLocalClockSnapshot) {
  const projection = projectBusinessOperatingRules({ rules, clock });
  return resolveBusinessOperationalState({
    ...businessOperatingRulesToOperationalInput(projection),
    now: clock.instant,
    maxScheduleAgeMs: 30 * 24 * 60 * 60 * 1000,
  });
}

const morning = stateAt(snapshot('2026-09-17T13:00:00Z', '10:00'));
const evening = stateAt(snapshot('2026-09-17T22:00:00Z', '19:00'));

assert(morning.state === 'open_now', 'The same stored schedule should project open during its current interval.');
assert(evening.state === 'closed_now', 'The same stored schedule should project closed after the interval without requiring an owner write.');
assert(
  morning.confirmedAt === evening.confirmedAt && morning.confirmedAt === rules.confirmedAt,
  'Read-time state changes must not fake a new owner confirmation timestamp.',
);

console.log('PASS: Local Business operating state is projected at read time');
