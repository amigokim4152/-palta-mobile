import type {
  BusinessOperationalOverride,
} from './businessOperationalState.js';

export type BusinessWeekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export type BusinessOperatingInterval = Readonly<{
  opensAt: string;
  closesAt: string;
}>;

export type BusinessWeeklySchedule = Readonly<
  Partial<Record<BusinessWeekday, readonly BusinessOperatingInterval[]>>
>;

export type BusinessSeasonalSchedule = Readonly<{
  id: string;
  startsOn: string;
  endsOn: string;
  weekly: BusinessWeeklySchedule;
}>;

export type BusinessSeasonalClosure = Readonly<{
  id: string;
  startsOn: string;
  endsOn: string;
  confirmedAt: string;
}>;

export type BusinessDateException = Readonly<{
  date: string;
  kind: 'closed_all_day' | 'custom_hours';
  intervals?: readonly BusinessOperatingInterval[];
  confirmedAt: string;
}>;

export type BusinessTemporaryClosure = Readonly<{
  id: string;
  effectiveFrom: string;
  effectiveUntil: string;
  confirmedAt: string;
}>;

export type BusinessOperatingRules = Readonly<{
  timezone: string;
  weekly: BusinessWeeklySchedule;
  seasonalSchedules?: readonly BusinessSeasonalSchedule[];
  seasonalClosures?: readonly BusinessSeasonalClosure[];
  dateExceptions?: readonly BusinessDateException[];
  temporaryClosures?: readonly BusinessTemporaryClosure[];
  confirmedAt: string;
}>;

export type BusinessLocalClockSnapshot = Readonly<{
  instant: string;
  timezone: string;
  localDate: string;
  localTime: string;
  weekday: BusinessWeekday;
}>;

export type BusinessLocalOpening = Readonly<{
  localDate: string;
  localTime: string;
}>;

export type BusinessOperatingRulesProjection = Readonly<{
  timezone: string;
  evaluatedAt: string;
  localDate: string;
  localTime: string;
  scheduledOpenNow?: boolean;
  scheduledClosedToday?: boolean;
  scheduleConfirmedAt: string;
  activeScheduleSource?: 'weekly' | 'seasonal' | 'date_exception';
  activeScheduleId?: string;
  nextOpenLocal?: BusinessLocalOpening;
  override?: BusinessOperationalOverride;
}>;

const WEEKDAYS: readonly BusinessWeekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function isValidMonthDay(value: string): boolean {
  if (!/^\d{2}-\d{2}$/.test(value)) return false;
  const [monthText, dayText] = value.split('-');
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(2024, month - 1, day));
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

function minuteOfDay(value: string): number {
  if (!/^\d{2}:\d{2}$/.test(value)) throw new Error(`Invalid local time: ${value}`);
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error(`Invalid local time: ${value}`);
  }
  return hour * 60 + minute;
}

function validateInterval(interval: BusinessOperatingInterval): void {
  minuteOfDay(interval.opensAt);
  minuteOfDay(interval.closesAt);
  if (interval.opensAt === interval.closesAt) {
    throw new Error('Operating interval cannot open and close at the same time');
  }
}

function weekdayForDate(localDate: string): BusinessWeekday {
  if (!isValidDate(localDate)) throw new Error(`Invalid local date: ${localDate}`);
  const date = new Date(`${localDate}T00:00:00Z`);
  return WEEKDAYS[date.getUTCDay()]!;
}

function addLocalDays(localDate: string, days: number): string {
  if (!isValidDate(localDate)) throw new Error(`Invalid local date: ${localDate}`);
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthDay(localDate: string): string {
  return localDate.slice(5, 10);
}

function annualRangeContains(localDate: string, startsOn: string, endsOn: string): boolean {
  if (!isValidMonthDay(startsOn) || !isValidMonthDay(endsOn)) {
    throw new Error('Invalid recurring month-day range');
  }
  const current = monthDay(localDate);
  if (startsOn <= endsOn) return current >= startsOn && current <= endsOn;
  return current >= startsOn || current <= endsOn;
}

function activeSeasonalSchedule(
  localDate: string,
  schedules: readonly BusinessSeasonalSchedule[],
): BusinessSeasonalSchedule | undefined {
  const matching = schedules.filter((schedule) =>
    annualRangeContains(localDate, schedule.startsOn, schedule.endsOn),
  );
  if (matching.length > 1) throw new Error('Overlapping seasonal schedules are not allowed');
  return matching[0];
}

function activeSeasonalClosure(
  localDate: string,
  closures: readonly BusinessSeasonalClosure[],
): BusinessSeasonalClosure | undefined {
  const matching = closures.filter((closure) =>
    annualRangeContains(localDate, closure.startsOn, closure.endsOn),
  );
  if (matching.length > 1) throw new Error('Overlapping seasonal closures are not allowed');
  return matching[0];
}

function exactDateException(
  localDate: string,
  exceptions: readonly BusinessDateException[],
): BusinessDateException | undefined {
  const matching = exceptions.filter((exception) => exception.date === localDate);
  if (matching.length > 1) throw new Error('Multiple operating exceptions for the same date are not allowed');
  return matching[0];
}

function activeTemporaryClosure(
  nowMs: number,
  closures: readonly BusinessTemporaryClosure[],
): BusinessTemporaryClosure | undefined {
  const matching = closures.filter((closure) => {
    const from = Date.parse(closure.effectiveFrom);
    const until = Date.parse(closure.effectiveUntil);
    if (!Number.isFinite(from) || !Number.isFinite(until) || from >= until) {
      throw new Error('Invalid temporary closure window');
    }
    return nowMs >= from && nowMs < until;
  });
  if (matching.length > 1) throw new Error('Overlapping temporary closures are not allowed');
  return matching[0];
}

function scheduleForDate(
  rules: BusinessOperatingRules,
  localDate: string,
): {
  intervals: readonly BusinessOperatingInterval[];
  source: 'weekly' | 'seasonal' | 'date_exception';
  sourceId?: string;
  closedByException: boolean;
} {
  const exception = exactDateException(localDate, rules.dateExceptions ?? []);
  if (exception) {
    if (exception.kind === 'closed_all_day') {
      return {
        intervals: [],
        source: 'date_exception',
        sourceId: localDate,
        closedByException: true,
      };
    }
    const intervals = exception.intervals ?? [];
    for (const interval of intervals) validateInterval(interval);
    return {
      intervals,
      source: 'date_exception',
      sourceId: localDate,
      closedByException: intervals.length === 0,
    };
  }

  const seasonal = activeSeasonalSchedule(localDate, rules.seasonalSchedules ?? []);
  const weekly = seasonal?.weekly ?? rules.weekly;
  const intervals = weekly[weekdayForDate(localDate)] ?? [];
  for (const interval of intervals) validateInterval(interval);
  return {
    intervals,
    source: seasonal ? 'seasonal' : 'weekly',
    ...(seasonal ? { sourceId: seasonal.id } : {}),
    closedByException: false,
  };
}

function intervalContainsMinute(interval: BusinessOperatingInterval, minute: number): boolean {
  const opens = minuteOfDay(interval.opensAt);
  const closes = minuteOfDay(interval.closesAt);
  if (opens < closes) return minute >= opens && minute < closes;
  return minute >= opens || minute < closes;
}

function previousDayOvernightContains(
  rules: BusinessOperatingRules,
  localDate: string,
  minute: number,
): boolean {
  const previousDate = addLocalDays(localDate, -1);
  const previous = scheduleForDate(rules, previousDate);
  return previous.intervals.some((interval) => {
    const opens = minuteOfDay(interval.opensAt);
    const closes = minuteOfDay(interval.closesAt);
    return opens > closes && minute < closes;
  });
}

function opensLaterToday(
  intervals: readonly BusinessOperatingInterval[],
  minute: number,
): string | undefined {
  const candidates = intervals
    .map((interval) => ({ interval, opens: minuteOfDay(interval.opensAt), closes: minuteOfDay(interval.closesAt) }))
    .filter(({ opens, closes }) => opens < closes && opens > minute)
    .sort((a, b) => a.opens - b.opens);
  return candidates[0]?.interval.opensAt;
}

function findNextOpenLocal(
  rules: BusinessOperatingRules,
  localDate: string,
  localTime: string,
): BusinessLocalOpening | undefined {
  const minute = minuteOfDay(localTime);
  const today = scheduleForDate(rules, localDate);
  const laterToday = opensLaterToday(today.intervals, minute);
  if (laterToday) return { localDate, localTime: laterToday };

  for (let offset = 1; offset <= 370; offset += 1) {
    const candidateDate = addLocalDays(localDate, offset);
    if (activeSeasonalClosure(candidateDate, rules.seasonalClosures ?? [])) continue;
    const candidate = scheduleForDate(rules, candidateDate);
    if (!candidate.intervals.length) continue;
    const first = [...candidate.intervals]
      .sort((a, b) => minuteOfDay(a.opensAt) - minuteOfDay(b.opensAt))[0];
    if (first) return { localDate: candidateDate, localTime: first.opensAt };
  }
  return undefined;
}

export function buildBusinessLocalClock(
  now: string | Date,
  timezone: string,
): BusinessLocalClockSnapshot {
  const instant = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(instant.getTime())) throw new Error('Invalid operating clock instant');

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const localTime = `${parts.hour}:${parts.minute}`;
  if (!isValidDate(localDate)) throw new Error('Could not build local operating date');
  minuteOfDay(localTime);
  return {
    instant: instant.toISOString(),
    timezone,
    localDate,
    localTime,
    weekday: weekdayForDate(localDate),
  };
}

/**
 * Deterministically evaluates owner operating rules using an explicit local clock.
 * It does not send notifications and does not use AI. Date exceptions outrank
 * seasonal schedules, seasonal schedules outrank the base weekly schedule, while
 * explicit temporary/seasonal closures become operational overrides.
 */
export function projectBusinessOperatingRules(input: {
  rules: BusinessOperatingRules;
  clock: BusinessLocalClockSnapshot;
}): BusinessOperatingRulesProjection {
  if (input.clock.timezone !== input.rules.timezone) {
    throw new Error('Operating clock timezone must match Business rules timezone');
  }
  if (!isValidDate(input.clock.localDate)) throw new Error('Invalid operating local date');
  const minute = minuteOfDay(input.clock.localTime);
  const nowMs = Date.parse(input.clock.instant);
  if (!Number.isFinite(nowMs)) throw new Error('Invalid operating instant');

  const temporary = activeTemporaryClosure(nowMs, input.rules.temporaryClosures ?? []);
  if (temporary) {
    return {
      timezone: input.rules.timezone,
      evaluatedAt: input.clock.instant,
      localDate: input.clock.localDate,
      localTime: input.clock.localTime,
      scheduleConfirmedAt: input.rules.confirmedAt,
      override: {
        state: 'temporarily_closed',
        source: 'owner',
        confirmedAt: temporary.confirmedAt,
        effectiveFrom: temporary.effectiveFrom,
        effectiveUntil: temporary.effectiveUntil,
      },
    };
  }

  const seasonalClosure = activeSeasonalClosure(
    input.clock.localDate,
    input.rules.seasonalClosures ?? [],
  );
  if (seasonalClosure) {
    const nextOpenLocal = findNextOpenLocal(
      input.rules,
      input.clock.localDate,
      input.clock.localTime,
    );
    return {
      timezone: input.rules.timezone,
      evaluatedAt: input.clock.instant,
      localDate: input.clock.localDate,
      localTime: input.clock.localTime,
      scheduleConfirmedAt: input.rules.confirmedAt,
      ...(nextOpenLocal ? { nextOpenLocal } : {}),
      override: {
        state: 'seasonal_closed',
        source: 'owner',
        confirmedAt: seasonalClosure.confirmedAt,
      },
    };
  }

  const schedule = scheduleForDate(input.rules, input.clock.localDate);
  if (schedule.closedByException) {
    const exception = exactDateException(
      input.clock.localDate,
      input.rules.dateExceptions ?? [],
    );
    const nextOpenLocal = findNextOpenLocal(
      input.rules,
      input.clock.localDate,
      input.clock.localTime,
    );
    return {
      timezone: input.rules.timezone,
      evaluatedAt: input.clock.instant,
      localDate: input.clock.localDate,
      localTime: input.clock.localTime,
      scheduleConfirmedAt: input.rules.confirmedAt,
      activeScheduleSource: 'date_exception',
      activeScheduleId: input.clock.localDate,
      ...(nextOpenLocal ? { nextOpenLocal } : {}),
      override: {
        state: 'closed_today',
        source: 'owner',
        ...(exception?.confirmedAt ? { confirmedAt: exception.confirmedAt } : {}),
      },
    };
  }

  const openFromToday = schedule.intervals.some((interval) =>
    intervalContainsMinute(interval, minute),
  );
  const openFromPreviousOvernight = previousDayOvernightContains(
    input.rules,
    input.clock.localDate,
    minute,
  );
  const scheduledOpenNow = openFromToday || openFromPreviousOvernight;
  const nextOpenLocal = scheduledOpenNow
    ? undefined
    : findNextOpenLocal(input.rules, input.clock.localDate, input.clock.localTime);

  return {
    timezone: input.rules.timezone,
    evaluatedAt: input.clock.instant,
    localDate: input.clock.localDate,
    localTime: input.clock.localTime,
    scheduledOpenNow,
    scheduledClosedToday: schedule.intervals.length === 0,
    scheduleConfirmedAt: input.rules.confirmedAt,
    activeScheduleSource: schedule.source,
    ...(schedule.sourceId ? { activeScheduleId: schedule.sourceId } : {}),
    ...(nextOpenLocal ? { nextOpenLocal } : {}),
  };
}
