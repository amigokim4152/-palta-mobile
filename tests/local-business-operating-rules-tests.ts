import {
  buildBusinessLocalClock,
  businessOperatingRulesToOperationalInput,
  projectBusinessOperatingRules,
  type BusinessLocalClockSnapshot,
  type BusinessOperatingRules,
} from '../src/business/businessOperatingRules.js';
import { resolveBusinessOperationalState } from '../src/business/businessOperationalState.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function clock(input: {
  instant: string;
  localDate: string;
  localTime: string;
  weekday: BusinessLocalClockSnapshot['weekday'];
}): BusinessLocalClockSnapshot {
  return {
    instant: input.instant,
    timezone: 'America/Santiago',
    localDate: input.localDate,
    localTime: input.localTime,
    weekday: input.weekday,
  };
}

const baseRules: BusinessOperatingRules = {
  timezone: 'America/Santiago',
  confirmedAt: '2026-07-10T15:00:00Z',
  weekly: {
    monday: [{ opensAt: '12:00', closesAt: '20:00' }],
    tuesday: [{ opensAt: '12:00', closesAt: '20:00' }],
    wednesday: [{ opensAt: '12:00', closesAt: '20:00' }],
    thursday: [{ opensAt: '12:00', closesAt: '20:00' }],
    friday: [{ opensAt: '12:00', closesAt: '23:00' }],
    saturday: [{ opensAt: '12:00', closesAt: '23:00' }],
    sunday: [{ opensAt: '12:00', closesAt: '23:00' }],
  },
  seasonalSchedules: [
    {
      id: 'low-season-may-aug',
      startsOn: '05-01',
      endsOn: '08-31',
      weekly: {
        friday: [{ opensAt: '12:00', closesAt: '20:00' }],
        saturday: [{ opensAt: '12:00', closesAt: '20:00' }],
        sunday: [{ opensAt: '12:00', closesAt: '20:00' }],
      },
    },
  ],
};

const winterClock = buildBusinessLocalClock(
  '2026-07-15T16:30:00Z',
  'America/Santiago',
);
assert(winterClock.localDate === '2026-07-15', 'Chile winter clock should preserve Santiago local date.');
assert(winterClock.localTime === '12:30', 'Chile winter clock should use the IANA timezone rather than a hard-coded offset.');
assert(winterClock.weekday === 'wednesday', 'Local weekday should derive from the local business date.');

const summerClock = buildBusinessLocalClock(
  '2026-12-15T15:30:00Z',
  'America/Santiago',
);
assert(summerClock.localTime === '12:30', 'Chile summer clock should follow the IANA timezone DST rules.');

const lowSeasonWednesday = projectBusinessOperatingRules({
  rules: baseRules,
  clock: winterClock,
});
assert(lowSeasonWednesday.scheduledOpenNow === false, 'Low-season Wednesday should be closed.');
assert(lowSeasonWednesday.scheduledClosedToday === true, 'No low-season Wednesday interval should project closed-today.');
assert(lowSeasonWednesday.activeScheduleSource === 'seasonal', 'Low-season weekly override should outrank the base schedule.');
assert(lowSeasonWednesday.activeScheduleId === 'low-season-may-aug', 'Projection should retain the active seasonal rule id.');
assert(
  lowSeasonWednesday.nextOpenLocal?.localDate === '2026-07-17' &&
    lowSeasonWednesday.nextOpenLocal.localTime === '12:00',
  'Low-season next opening should skip closed weekdays and find Friday.',
);

const closedTodayState = resolveBusinessOperationalState({
  ...businessOperatingRulesToOperationalInput(
    lowSeasonWednesday,
    (opening) =>
      opening.localDate === '2026-07-17' && opening.localTime === '12:00'
        ? '2026-07-17T16:00:00Z'
        : undefined,
  ),
  now: winterClock.instant,
  maxScheduleAgeMs: 14 * 24 * 60 * 60 * 1000,
});
assert(closedTodayState.state === 'closed_today', 'Normalized empty daily schedule should become closed_today.');
assert(closedTodayState.nextOpenAt === '2026-07-17T16:00:00Z', 'Time adapter may attach an absolute next opening without changing domain rules.');

const friday = projectBusinessOperatingRules({
  rules: baseRules,
  clock: clock({
    instant: '2026-07-17T17:00:00Z',
    localDate: '2026-07-17',
    localTime: '13:00',
    weekday: 'friday',
  }),
});
assert(friday.scheduledOpenNow === true, 'Low-season Friday should open from the seasonal schedule.');
assert(
  resolveBusinessOperationalState({
    ...businessOperatingRulesToOperationalInput(friday),
    now: '2026-07-17T17:00:00Z',
    maxScheduleAgeMs: 14 * 24 * 60 * 60 * 1000,
  }).state === 'open_now',
  'Operating rules should feed the existing operational-state resolver rather than a parallel status engine.',
);

const closedExceptionRules: BusinessOperatingRules = {
  ...baseRules,
  dateExceptions: [
    {
      date: '2026-07-18',
      kind: 'closed_all_day',
      confirmedAt: '2026-07-17T18:00:00Z',
    },
  ],
};
const closedException = projectBusinessOperatingRules({
  rules: closedExceptionRules,
  clock: clock({
    instant: '2026-07-18T17:00:00Z',
    localDate: '2026-07-18',
    localTime: '13:00',
    weekday: 'saturday',
  }),
});
assert(closedException.override?.state === 'closed_today', 'Owner all-day exception should outrank the normal Saturday schedule.');
assert(closedException.override?.source === 'owner', 'Owner exception should retain owner evidence source.');

const temporaryRules: BusinessOperatingRules = {
  ...baseRules,
  temporaryClosures: [
    {
      id: 'repair-closure',
      effectiveFrom: '2026-07-17T16:00:00Z',
      effectiveUntil: '2026-07-17T20:00:00Z',
      confirmedAt: '2026-07-17T15:50:00Z',
    },
  ],
};
const temporary = projectBusinessOperatingRules({
  rules: temporaryRules,
  clock: clock({
    instant: '2026-07-17T17:00:00Z',
    localDate: '2026-07-17',
    localTime: '13:00',
    weekday: 'friday',
  }),
});
assert(temporary.override?.state === 'temporarily_closed', 'Temporary closure should outrank an otherwise open schedule.');

const seasonalClosureRules: BusinessOperatingRules = {
  timezone: 'America/Santiago',
  confirmedAt: '2026-04-20T14:00:00Z',
  weekly: baseRules.weekly,
  seasonalClosures: [
    {
      id: 'winter-closed',
      startsOn: '05-01',
      endsOn: '08-31',
      confirmedAt: '2026-04-20T14:00:00Z',
    },
  ],
};
const seasonalClosure = projectBusinessOperatingRules({
  rules: seasonalClosureRules,
  clock: winterClock,
});
assert(seasonalClosure.override?.state === 'seasonal_closed', 'Full recurring seasonal closure should be distinct from ordinary closed hours.');
assert(
  seasonalClosure.nextOpenLocal?.localDate === '2026-09-01',
  'Next opening should skip the full seasonal closure window.',
);

const overnightRules: BusinessOperatingRules = {
  timezone: 'America/Santiago',
  confirmedAt: '2026-01-01T12:00:00Z',
  weekly: {
    friday: [{ opensAt: '18:00', closesAt: '02:00' }],
  },
};
const fridayEarly = projectBusinessOperatingRules({
  rules: overnightRules,
  clock: clock({
    instant: '2026-01-02T04:00:00Z',
    localDate: '2026-01-02',
    localTime: '01:00',
    weekday: 'friday',
  }),
});
assert(fridayEarly.scheduledOpenNow === false, 'Friday 01:00 must not be attributed to Friday evening overnight hours.');
assert(fridayEarly.nextOpenLocal?.localTime === '18:00', 'Friday overnight service should next open Friday evening.');

const saturdayEarly = projectBusinessOperatingRules({
  rules: overnightRules,
  clock: clock({
    instant: '2026-01-03T04:00:00Z',
    localDate: '2026-01-03',
    localTime: '01:00',
    weekday: 'saturday',
  }),
});
assert(saturdayEarly.scheduledOpenNow === true, 'Saturday 01:00 should inherit Friday 18:00–02:00 overnight service.');
assert(saturdayEarly.scheduledClosedToday === false, 'An active overnight carryover must not simultaneously claim closed-today.');

console.log('PASS: Local Business deterministic operating rules');
