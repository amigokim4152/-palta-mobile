import {
  clearBusinessDateException,
  clearBusinessTemporaryClosure,
  closeBusinessTemporarily,
  closeBusinessToday,
  removeBusinessSeasonalClosure,
  removeBusinessSeasonalSchedule,
  replaceBusinessWeeklySchedule,
  setBusinessOperatingDay,
  setBusinessTodayHours,
  upsertBusinessSeasonalClosure,
  upsertBusinessSeasonalSchedule,
} from '../src/business/businessOperatingRuleMutations.js';
import {
  projectBusinessOperatingRules,
  type BusinessOperatingRules,
} from '../src/business/businessOperatingRules.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const base: BusinessOperatingRules = {
  timezone: 'America/Santiago',
  confirmedAt: '2026-09-01T12:00:00Z',
  weekly: {
    monday: [{ opensAt: '09:00', closesAt: '18:00' }],
    tuesday: [{ opensAt: '09:00', closesAt: '18:00' }],
    wednesday: [{ opensAt: '09:00', closesAt: '18:00' }],
    thursday: [{ opensAt: '09:00', closesAt: '18:00' }],
    friday: [{ opensAt: '09:00', closesAt: '18:00' }],
  },
};

const closedToday = closeBusinessToday({
  rules: base,
  localDate: '2026-09-17',
  confirmedAt: '2026-09-17T14:00:00Z',
});
assert(closedToday.weekly.monday?.[0]?.opensAt === '09:00', 'Quick close must not rewrite normal weekly hours.');
assert(closedToday.dateExceptions?.length === 1, 'Close today should create one date exception.');
assert(closedToday.dateExceptions?.[0]?.kind === 'closed_all_day', 'Close today should use an all-day exception.');

const replacedToday = setBusinessTodayHours({
  rules: closedToday,
  localDate: '2026-09-17',
  intervals: [{ opensAt: '12:00', closesAt: '16:00' }],
  confirmedAt: '2026-09-17T14:05:00Z',
});
assert(replacedToday.dateExceptions?.length === 1, 'Changing today should replace, not duplicate, the same date exception.');
assert(replacedToday.dateExceptions?.[0]?.kind === 'custom_hours', 'Today custom hours should replace the close-all-day exception.');
assert(replacedToday.dateExceptions?.[0]?.intervals?.[0]?.closesAt === '16:00', 'Today custom closing time should be retained.');

const restoredToday = clearBusinessDateException({
  rules: replacedToday,
  localDate: '2026-09-17',
  confirmedAt: '2026-09-17T14:10:00Z',
});
assert(restoredToday.dateExceptions?.length === 0, 'Returning to normal should remove only today exception.');
assert(restoredToday.weekly.thursday?.[0]?.closesAt === '18:00', 'Returning to normal should preserve normal Thursday hours.');

const changedSaturday = setBusinessOperatingDay({
  rules: restoredToday,
  weekday: 'saturday',
  intervals: [{ opensAt: '10:00', closesAt: '14:00' }],
  confirmedAt: '2026-09-17T14:15:00Z',
});
assert(changedSaturday.weekly.saturday?.[0]?.opensAt === '10:00', 'Owner should be able to add one weekly operating day.');
assert(changedSaturday.weekly.friday?.[0]?.opensAt === '09:00', 'Changing one day must preserve the rest of the week.');

const replacedWeek = replaceBusinessWeeklySchedule({
  rules: changedSaturday,
  weekly: {
    friday: [{ opensAt: '12:00', closesAt: '20:00' }],
    saturday: [{ opensAt: '12:00', closesAt: '20:00' }],
    sunday: [{ opensAt: '12:00', closesAt: '20:00' }],
  },
  confirmedAt: '2026-09-17T14:20:00Z',
});
assert(!replacedWeek.weekly.monday, 'Replacing the week should allow a low-season Fri-Sun schedule.');
assert(replacedWeek.weekly.sunday?.[0]?.closesAt === '20:00', 'Replacement schedule should retain supplied Sunday hours.');

const seasonal = upsertBusinessSeasonalSchedule({
  rules: base,
  scheduleId: 'low-season',
  startsOn: '05-01',
  endsOn: '08-31',
  weekly: {
    friday: [{ opensAt: '12:00', closesAt: '20:00' }],
    saturday: [{ opensAt: '12:00', closesAt: '20:00' }],
    sunday: [{ opensAt: '12:00', closesAt: '20:00' }],
  },
  confirmedAt: '2026-04-20T14:00:00Z',
});
assert(seasonal.weekly.monday?.[0]?.opensAt === '09:00', 'Seasonal schedule must not replace the normal annual schedule.');
assert(seasonal.seasonalSchedules?.length === 1, 'Low season should be stored as a recurring seasonal schedule.');

const lowSeasonWednesday = projectBusinessOperatingRules({
  rules: seasonal,
  clock: {
    instant: '2026-06-10T16:00:00Z',
    timezone: 'America/Santiago',
    localDate: '2026-06-10',
    localTime: '12:00',
    weekday: 'wednesday',
  },
});
assert(lowSeasonWednesday.scheduledClosedToday === true, 'Algarrobo-style low season should automatically close weekdays not configured in the seasonal rule.');
assert(lowSeasonWednesday.nextOpenLocal?.localDate === '2026-06-12', 'Low season should automatically find the next configured Friday opening.');

const regularSeptember = projectBusinessOperatingRules({
  rules: seasonal,
  clock: {
    instant: '2026-09-09T16:00:00Z',
    timezone: 'America/Santiago',
    localDate: '2026-09-09',
    localTime: '12:00',
    weekday: 'wednesday',
  },
});
assert(regularSeptember.scheduledOpenNow === true, 'After low season ends, the normal weekly schedule should resume automatically.');

const seasonalUpdated = upsertBusinessSeasonalSchedule({
  rules: seasonal,
  scheduleId: 'low-season',
  startsOn: '05-15',
  endsOn: '08-15',
  weekly: {
    saturday: [{ opensAt: '11:00', closesAt: '18:00' }],
    sunday: [{ opensAt: '11:00', closesAt: '18:00' }],
  },
  confirmedAt: '2026-04-21T14:00:00Z',
});
assert(seasonalUpdated.seasonalSchedules?.length === 1, 'Updating one season should replace the same season id, not duplicate it.');
assert(seasonalUpdated.seasonalSchedules?.[0]?.startsOn === '05-15', 'Updated recurring season dates should be retained.');

let overlappingSeasonRejected = false;
try {
  upsertBusinessSeasonalSchedule({
    rules: seasonalUpdated,
    scheduleId: 'winter-weekends',
    startsOn: '08-01',
    endsOn: '09-30',
    weekly: { saturday: [{ opensAt: '10:00', closesAt: '16:00' }] },
    confirmedAt: '2026-04-22T14:00:00Z',
  });
} catch {
  overlappingSeasonRejected = true;
}
assert(overlappingSeasonRejected, 'Overlapping recurring seasonal schedules must be rejected before persistence.');

const noSeason = removeBusinessSeasonalSchedule({
  rules: seasonalUpdated,
  scheduleId: 'low-season',
  confirmedAt: '2026-08-16T14:00:00Z',
});
assert(noSeason.seasonalSchedules?.length === 0, 'Owner should be able to end a recurring seasonal schedule without touching normal hours.');
assert(noSeason.weekly.monday?.[0]?.opensAt === '09:00', 'Removing a seasonal schedule must preserve normal weekly hours.');

const winterClosure = upsertBusinessSeasonalClosure({
  rules: base,
  closureId: 'winter-closure',
  startsOn: '06-01',
  endsOn: '07-15',
  confirmedAt: '2026-05-20T14:00:00Z',
});
const winterProjection = projectBusinessOperatingRules({
  rules: winterClosure,
  clock: {
    instant: '2026-06-10T16:00:00Z',
    timezone: 'America/Santiago',
    localDate: '2026-06-10',
    localTime: '12:00',
    weekday: 'wednesday',
  },
});
assert(winterProjection.override?.state === 'seasonal_closed', 'A recurring full-season closure should project as seasonal_closed.');

const noWinterClosure = removeBusinessSeasonalClosure({
  rules: winterClosure,
  closureId: 'winter-closure',
  confirmedAt: '2026-07-16T14:00:00Z',
});
assert(noWinterClosure.seasonalClosures?.length === 0, 'Owner should be able to remove a recurring seasonal closure independently.');

const temporary = closeBusinessTemporarily({
  rules: replacedWeek,
  closureId: 'owner-temporary',
  effectiveFrom: '2026-09-18T15:00:00Z',
  effectiveUntil: '2026-09-25T15:00:00Z',
  confirmedAt: '2026-09-18T14:50:00Z',
});
assert(temporary.temporaryClosures?.length === 1, 'Temporary closure should be stored separately from weekly hours.');

const projectedTemporary = projectBusinessOperatingRules({
  rules: temporary,
  clock: {
    instant: '2026-09-19T16:00:00Z',
    timezone: 'America/Santiago',
    localDate: '2026-09-19',
    localTime: '13:00',
    weekday: 'saturday',
  },
});
assert(projectedTemporary.override?.state === 'temporarily_closed', 'Owner temporary closure should override an otherwise open Saturday.');

const reopened = clearBusinessTemporaryClosure({
  rules: temporary,
  closureId: 'owner-temporary',
  confirmedAt: '2026-09-19T17:00:00Z',
});
assert(reopened.temporaryClosures?.length === 0, 'Reopen should remove the selected temporary closure only.');

let invalidRejected = false;
try {
  setBusinessTodayHours({
    rules: base,
    localDate: '2026-09-17',
    intervals: [{ opensAt: '25:00', closesAt: '18:00' }],
    confirmedAt: '2026-09-17T14:00:00Z',
  });
} catch {
  invalidRejected = true;
}
assert(invalidRejected, 'Invalid owner-entered local times must be rejected before persistence.');

console.log('PASS: Local Business owner operating rule mutations');
