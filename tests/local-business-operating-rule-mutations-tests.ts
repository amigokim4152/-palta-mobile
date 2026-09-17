import {
  clearBusinessDateException,
  clearBusinessTemporaryClosure,
  closeBusinessTemporarily,
  closeBusinessToday,
  replaceBusinessWeeklySchedule,
  setBusinessOperatingDay,
  setBusinessTodayHours,
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
