import type {
  BusinessDateException,
  BusinessOperatingInterval,
  BusinessOperatingRules,
  BusinessSeasonalClosure,
  BusinessSeasonalSchedule,
  BusinessTemporaryClosure,
  BusinessWeekday,
  BusinessWeeklySchedule,
} from './businessOperatingRules.js';

function assertIsoDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error('Invalid local operating date');
  }
}

function assertIsoInstant(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error('Invalid operating instant');
}

function assertLocalTime(value: string): void {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error('Invalid local operating time');
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('Invalid local operating time');
  }
}

function assertIntervals(intervals: readonly BusinessOperatingInterval[]): void {
  for (const interval of intervals) {
    assertLocalTime(interval.opensAt);
    assertLocalTime(interval.closesAt);
    if (interval.opensAt === interval.closesAt) {
      throw new Error('Operating interval cannot open and close at the same time');
    }
  }
}

function assertWeekly(weekly: BusinessWeeklySchedule): void {
  for (const intervals of Object.values(weekly)) {
    if (intervals) assertIntervals(intervals);
  }
}

function assertConfirmedAt(value: string): void {
  assertIsoInstant(value);
}

function monthDayOrdinal(value: string): number {
  if (!/^\d{2}-\d{2}$/.test(value)) throw new Error('Invalid recurring month-day');
  const [monthText, dayText] = value.split('-');
  const month = Number(monthText);
  const day = Number(dayText);
  const probe = new Date(Date.UTC(2024, month - 1, day));
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new Error('Invalid recurring month-day');
  }
  const yearStart = Date.UTC(2024, 0, 1);
  return Math.floor((probe.getTime() - yearStart) / (24 * 60 * 60 * 1000));
}

function annualRangeOrdinals(startsOn: string, endsOn: string): Set<number> {
  const start = monthDayOrdinal(startsOn);
  const end = monthDayOrdinal(endsOn);
  const values = new Set<number>();
  if (start <= end) {
    for (let day = start; day <= end; day += 1) values.add(day);
    return values;
  }
  for (let day = start; day <= 365; day += 1) values.add(day);
  for (let day = 0; day <= end; day += 1) values.add(day);
  return values;
}

function rangesOverlap(
  a: { startsOn: string; endsOn: string },
  b: { startsOn: string; endsOn: string },
): boolean {
  const aDays = annualRangeOrdinals(a.startsOn, a.endsOn);
  const bDays = annualRangeOrdinals(b.startsOn, b.endsOn);
  for (const day of aDays) {
    if (bDays.has(day)) return true;
  }
  return false;
}

function replaceDateException(
  rules: BusinessOperatingRules,
  exception: BusinessDateException,
): BusinessOperatingRules {
  const dateExceptions = [
    ...(rules.dateExceptions ?? []).filter((item) => item.date !== exception.date),
    exception,
  ].sort((a, b) => a.date.localeCompare(b.date));

  return { ...rules, dateExceptions };
}

export function replaceBusinessWeeklySchedule(input: {
  rules: BusinessOperatingRules;
  weekly: BusinessWeeklySchedule;
  confirmedAt: string;
}): BusinessOperatingRules {
  assertConfirmedAt(input.confirmedAt);
  assertWeekly(input.weekly);
  return {
    ...input.rules,
    weekly: input.weekly,
    confirmedAt: input.confirmedAt,
  };
}

export function setBusinessOperatingDay(input: {
  rules: BusinessOperatingRules;
  weekday: BusinessWeekday;
  intervals: readonly BusinessOperatingInterval[];
  confirmedAt: string;
}): BusinessOperatingRules {
  assertIntervals(input.intervals);
  assertConfirmedAt(input.confirmedAt);
  return {
    ...input.rules,
    confirmedAt: input.confirmedAt,
    weekly: {
      ...input.rules.weekly,
      [input.weekday]: [...input.intervals],
    },
  };
}

export function upsertBusinessSeasonalSchedule(input: {
  rules: BusinessOperatingRules;
  scheduleId: string;
  startsOn: string;
  endsOn: string;
  weekly: BusinessWeeklySchedule;
  confirmedAt: string;
}): BusinessOperatingRules {
  const id = input.scheduleId.trim();
  if (!id) throw new Error('Seasonal schedule id is required');
  annualRangeOrdinals(input.startsOn, input.endsOn);
  assertWeekly(input.weekly);
  assertConfirmedAt(input.confirmedAt);

  const others = (input.rules.seasonalSchedules ?? []).filter((item) => item.id !== id);
  const candidate: BusinessSeasonalSchedule = {
    id,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    weekly: input.weekly,
  };
  if (others.some((item) => rangesOverlap(item, candidate))) {
    throw new Error('Seasonal operating schedules cannot overlap');
  }

  return {
    ...input.rules,
    confirmedAt: input.confirmedAt,
    seasonalSchedules: [...others, candidate],
  };
}

export function removeBusinessSeasonalSchedule(input: {
  rules: BusinessOperatingRules;
  scheduleId: string;
  confirmedAt: string;
}): BusinessOperatingRules {
  const id = input.scheduleId.trim();
  if (!id) throw new Error('Seasonal schedule id is required');
  assertConfirmedAt(input.confirmedAt);
  return {
    ...input.rules,
    confirmedAt: input.confirmedAt,
    seasonalSchedules: (input.rules.seasonalSchedules ?? []).filter((item) => item.id !== id),
  };
}

export function upsertBusinessSeasonalClosure(input: {
  rules: BusinessOperatingRules;
  closureId: string;
  startsOn: string;
  endsOn: string;
  confirmedAt: string;
}): BusinessOperatingRules {
  const id = input.closureId.trim();
  if (!id) throw new Error('Seasonal closure id is required');
  annualRangeOrdinals(input.startsOn, input.endsOn);
  assertConfirmedAt(input.confirmedAt);

  const others = (input.rules.seasonalClosures ?? []).filter((item) => item.id !== id);
  const candidate: BusinessSeasonalClosure = {
    id,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    confirmedAt: input.confirmedAt,
  };
  if (others.some((item) => rangesOverlap(item, candidate))) {
    throw new Error('Seasonal closures cannot overlap');
  }

  return {
    ...input.rules,
    confirmedAt: input.confirmedAt,
    seasonalClosures: [...others, candidate],
  };
}

export function removeBusinessSeasonalClosure(input: {
  rules: BusinessOperatingRules;
  closureId: string;
  confirmedAt: string;
}): BusinessOperatingRules {
  const id = input.closureId.trim();
  if (!id) throw new Error('Seasonal closure id is required');
  assertConfirmedAt(input.confirmedAt);
  return {
    ...input.rules,
    confirmedAt: input.confirmedAt,
    seasonalClosures: (input.rules.seasonalClosures ?? []).filter((item) => item.id !== id),
  };
}

export function closeBusinessToday(input: {
  rules: BusinessOperatingRules;
  localDate: string;
  confirmedAt: string;
}): BusinessOperatingRules {
  assertIsoDate(input.localDate);
  assertConfirmedAt(input.confirmedAt);
  return replaceDateException(input.rules, {
    date: input.localDate,
    kind: 'closed_all_day',
    confirmedAt: input.confirmedAt,
  });
}

export function setBusinessTodayHours(input: {
  rules: BusinessOperatingRules;
  localDate: string;
  intervals: readonly BusinessOperatingInterval[];
  confirmedAt: string;
}): BusinessOperatingRules {
  assertIsoDate(input.localDate);
  assertIntervals(input.intervals);
  assertConfirmedAt(input.confirmedAt);
  return replaceDateException(input.rules, {
    date: input.localDate,
    kind: 'custom_hours',
    intervals: [...input.intervals],
    confirmedAt: input.confirmedAt,
  });
}

export function clearBusinessDateException(input: {
  rules: BusinessOperatingRules;
  localDate: string;
  confirmedAt: string;
}): BusinessOperatingRules {
  assertIsoDate(input.localDate);
  assertConfirmedAt(input.confirmedAt);
  return {
    ...input.rules,
    confirmedAt: input.confirmedAt,
    dateExceptions: (input.rules.dateExceptions ?? []).filter(
      (item) => item.date !== input.localDate,
    ),
  };
}

export function closeBusinessTemporarily(input: {
  rules: BusinessOperatingRules;
  closureId: string;
  effectiveFrom: string;
  effectiveUntil: string;
  confirmedAt: string;
}): BusinessOperatingRules {
  if (!input.closureId.trim()) throw new Error('Temporary closure id is required');
  assertIsoInstant(input.effectiveFrom);
  assertIsoInstant(input.effectiveUntil);
  assertConfirmedAt(input.confirmedAt);
  if (Date.parse(input.effectiveFrom) >= Date.parse(input.effectiveUntil)) {
    throw new Error('Temporary closure must end after it starts');
  }

  const closure: BusinessTemporaryClosure = {
    id: input.closureId.trim(),
    effectiveFrom: input.effectiveFrom,
    effectiveUntil: input.effectiveUntil,
    confirmedAt: input.confirmedAt,
  };
  return {
    ...input.rules,
    confirmedAt: input.confirmedAt,
    temporaryClosures: [
      ...(input.rules.temporaryClosures ?? []).filter(
        (item) => item.id !== closure.id,
      ),
      closure,
    ],
  };
}

export function clearBusinessTemporaryClosure(input: {
  rules: BusinessOperatingRules;
  closureId: string;
  confirmedAt: string;
}): BusinessOperatingRules {
  if (!input.closureId.trim()) throw new Error('Temporary closure id is required');
  assertConfirmedAt(input.confirmedAt);
  return {
    ...input.rules,
    confirmedAt: input.confirmedAt,
    temporaryClosures: (input.rules.temporaryClosures ?? []).filter(
      (item) => item.id !== input.closureId,
    ),
  };
}
