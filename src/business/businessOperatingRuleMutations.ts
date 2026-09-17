import type {
  BusinessDateException,
  BusinessOperatingInterval,
  BusinessOperatingRules,
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

function assertConfirmedAt(value: string): void {
  assertIsoInstant(value);
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
  for (const intervals of Object.values(input.weekly)) {
    if (intervals) assertIntervals(intervals);
  }
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
