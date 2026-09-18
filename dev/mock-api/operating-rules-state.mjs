const seededRules = new Map([
  ['biz-taller-1', {
    timezone: 'America/Santiago',
    confirmedAt: '2026-09-17T11:00:00-03:00',
    weekly: {
      monday: [{ opensAt: '09:00', closesAt: '18:00' }],
      tuesday: [{ opensAt: '09:00', closesAt: '18:00' }],
      wednesday: [{ opensAt: '09:00', closesAt: '18:00' }],
      thursday: [{ opensAt: '09:00', closesAt: '18:00' }],
      friday: [{ opensAt: '09:00', closesAt: '18:00' }],
      saturday: [{ opensAt: '09:00', closesAt: '14:00' }],
    },
    seasonalSchedules: [],
    seasonalClosures: [],
    dateExceptions: [],
    temporaryClosures: [],
  }],
  ['biz-farmacia-1', {
    timezone: 'America/Santiago',
    confirmedAt: '2026-09-18T06:00:00-03:00',
    weekly: {
      monday: [{ opensAt: '08:00', closesAt: '21:00' }],
      tuesday: [{ opensAt: '08:00', closesAt: '21:00' }],
      wednesday: [{ opensAt: '08:00', closesAt: '21:00' }],
      thursday: [{ opensAt: '08:00', closesAt: '21:00' }],
      friday: [{ opensAt: '08:00', closesAt: '21:00' }],
      saturday: [{ opensAt: '08:00', closesAt: '21:00' }],
    },
    seasonalSchedules: [],
    seasonalClosures: [],
    dateExceptions: [
      {
        date: '2026-09-18',
        kind: 'closed_all_day',
        confirmedAt: '2026-09-18T06:00:00-03:00',
      },
    ],
    temporaryClosures: [],
  }],
  ['biz-cafe-siete-granos', {
    timezone: 'America/Santiago',
    confirmedAt: '2026-09-18T06:00:00-03:00',
    weekly: {
      monday: [{ opensAt: '06:00', closesAt: '23:00' }],
      tuesday: [{ opensAt: '06:00', closesAt: '23:00' }],
      wednesday: [{ opensAt: '06:00', closesAt: '23:00' }],
      thursday: [{ opensAt: '06:00', closesAt: '23:00' }],
      friday: [{ opensAt: '06:00', closesAt: '23:00' }],
      saturday: [{ opensAt: '08:00', closesAt: '22:00' }],
      sunday: [{ opensAt: '08:00', closesAt: '22:00' }],
    },
    seasonalSchedules: [],
    seasonalClosures: [],
    dateExceptions: [],
    temporaryClosures: [],
  }],
  ['biz-patitas-en-casa', {
    timezone: 'America/Santiago',
    confirmedAt: '2026-09-18T06:00:00-03:00',
    weekly: {
      monday: [{ opensAt: '07:00', closesAt: '21:00' }],
      tuesday: [{ opensAt: '07:00', closesAt: '21:00' }],
      wednesday: [{ opensAt: '07:00', closesAt: '21:00' }],
      thursday: [{ opensAt: '07:00', closesAt: '21:00' }],
      friday: [{ opensAt: '07:00', closesAt: '21:00' }],
      saturday: [{ opensAt: '08:00', closesAt: '19:00' }],
    },
    seasonalSchedules: [],
    seasonalClosures: [],
    dateExceptions: [],
    temporaryClosures: [],
  }],
  ['biz-panaderia-trigal', {
    timezone: 'America/Santiago',
    confirmedAt: '2026-09-18T05:30:00-03:00',
    weekly: {
      monday: [{ opensAt: '05:30', closesAt: '20:30' }],
      tuesday: [{ opensAt: '05:30', closesAt: '20:30' }],
      wednesday: [{ opensAt: '05:30', closesAt: '20:30' }],
      thursday: [{ opensAt: '05:30', closesAt: '20:30' }],
      friday: [{ opensAt: '05:30', closesAt: '20:30' }],
      saturday: [{ opensAt: '05:30', closesAt: '20:30' }],
      sunday: [{ opensAt: '07:30', closesAt: '14:00' }],
    },
    seasonalSchedules: [],
    seasonalClosures: [],
    dateExceptions: [],
    temporaryClosures: [],
  }],
  ['biz-estudio-menta', {
    timezone: 'America/Santiago',
    confirmedAt: '2026-09-17T10:30:00-03:00',
    weekly: {
      tuesday: [{ opensAt: '10:00', closesAt: '20:00' }],
      wednesday: [{ opensAt: '10:00', closesAt: '20:00' }],
      thursday: [{ opensAt: '10:00', closesAt: '20:00' }],
      friday: [{ opensAt: '10:00', closesAt: '20:00' }],
      saturday: [{ opensAt: '10:00', closesAt: '20:00' }],
    },
    seasonalSchedules: [],
    seasonalClosures: [
      {
        id: 'demo-vacaciones-septiembre',
        startsOn: '09-15',
        endsOn: '09-22',
        confirmedAt: '2026-09-17T10:30:00-03:00',
      },
    ],
    dateExceptions: [],
    temporaryClosures: [],
  }],
  ['biz-clases-faro', {
    timezone: 'America/Santiago',
    confirmedAt: '2026-09-17T19:00:00-03:00',
    weekly: {
      monday: [{ opensAt: '15:00', closesAt: '21:00' }],
      tuesday: [{ opensAt: '15:00', closesAt: '21:00' }],
      wednesday: [{ opensAt: '15:00', closesAt: '21:00' }],
      thursday: [{ opensAt: '15:00', closesAt: '21:00' }],
      friday: [{ opensAt: '15:00', closesAt: '21:00' }],
      saturday: [{ opensAt: '10:00', closesAt: '14:00' }],
    },
    seasonalSchedules: [],
    seasonalClosures: [],
    dateExceptions: [],
    temporaryClosures: [],
  }],
]);

const weekdayKeys = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function isOwnerManaged(business) {
  return business?.verification_status === 'claimed' || business?.verification_status === 'verified';
}

function validTime(value) {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false;
  const [hourText, minuteText] = value.split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function minuteOfDay(value) {
  if (!validTime(value)) return null;
  const [hourText, minuteText] = value.split(':');
  return Number(hourText) * 60 + Number(minuteText);
}

function validIntervals(value) {
  return Array.isArray(value) && value.every((interval) =>
    interval &&
    validTime(interval.opensAt) &&
    validTime(interval.closesAt) &&
    interval.opensAt !== interval.closesAt
  );
}

function validWeekly(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.entries(value).every(([day, intervals]) =>
    weekdayKeys.includes(day) && validIntervals(intervals)
  );
}

function validMonthDay(value) {
  if (typeof value !== 'string' || !/^\d{2}-\d{2}$/.test(value)) return false;
  const [monthText, dayText] = value.split('-');
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(2024, month - 1, day));
  return probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

function annualRangeContains(localDate, startsOn, endsOn) {
  if (!validMonthDay(startsOn) || !validMonthDay(endsOn)) return false;
  const current = localDate.slice(5, 10);
  if (startsOn <= endsOn) return current >= startsOn && current <= endsOn;
  return current >= startsOn || current <= endsOn;
}

function activeSeasonalSchedule(rules, localDate) {
  return (rules.seasonalSchedules ?? []).find((item) =>
    annualRangeContains(localDate, item.startsOn, item.endsOn)
  );
}

function activeSeasonalClosure(rules, localDate) {
  return (rules.seasonalClosures ?? []).find((item) =>
    annualRangeContains(localDate, item.startsOn, item.endsOn)
  );
}

function localClock(timezone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now).map((part) => [part.type, part.value]),
  );
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const localTime = `${parts.hour}:${parts.minute}`;
  const date = new Date(`${localDate}T00:00:00Z`);
  return {
    localDate,
    localTime,
    weekday: weekdayKeys[date.getUTCDay()],
  };
}

function addLocalDays(localDate, days) {
  const date = new Date(`${localDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function scheduleForDate(rules, localDate) {
  const exception = (rules.dateExceptions ?? []).find((item) => item.date === localDate);
  if (exception) {
    return exception.kind === 'closed_all_day' ? [] : [...(exception.intervals ?? [])];
  }
  const seasonal = activeSeasonalSchedule(rules, localDate);
  const weekly = seasonal?.weekly ?? rules.weekly;
  const date = new Date(`${localDate}T00:00:00Z`);
  return [...(weekly?.[weekdayKeys[date.getUTCDay()]] ?? [])];
}

function intervalContains(interval, minute) {
  const opens = minuteOfDay(interval.opensAt);
  const closes = minuteOfDay(interval.closesAt);
  if (opens === null || closes === null) return false;
  if (opens < closes) return minute >= opens && minute < closes;
  return minute >= opens;
}

function previousOvernightOpen(rules, localDate, minute) {
  const previousDate = addLocalDays(localDate, -1);
  return scheduleForDate(rules, previousDate).some((interval) => {
    const opens = minuteOfDay(interval.opensAt);
    const closes = minuteOfDay(interval.closesAt);
    return opens !== null && closes !== null && opens > closes && minute < closes;
  });
}

function nextOpenLocal(rules, localDate, localTime) {
  const minute = minuteOfDay(localTime) ?? 0;
  if (!activeSeasonalClosure(rules, localDate)) {
    const todayCandidates = scheduleForDate(rules, localDate)
      .filter((interval) => {
        const opens = minuteOfDay(interval.opensAt);
        return opens !== null && opens > minute;
      })
      .sort((a, b) => (minuteOfDay(a.opensAt) ?? 0) - (minuteOfDay(b.opensAt) ?? 0));
    if (todayCandidates[0]) {
      return { localDate, localTime: todayCandidates[0].opensAt };
    }
  }

  for (let offset = 1; offset <= 370; offset += 1) {
    const candidateDate = addLocalDays(localDate, offset);
    if (activeSeasonalClosure(rules, candidateDate)) continue;
    const candidates = scheduleForDate(rules, candidateDate)
      .slice()
      .sort((a, b) => (minuteOfDay(a.opensAt) ?? 0) - (minuteOfDay(b.opensAt) ?? 0));
    if (candidates[0]) return { localDate: candidateDate, localTime: candidates[0].opensAt };
  }
  return undefined;
}

function hasConfiguredSchedule(rules) {
  const weeklyHasHours = Object.values(rules.weekly ?? {}).some(
    (intervals) => Array.isArray(intervals) && intervals.length > 0,
  );
  const seasonalHasHours = (rules.seasonalSchedules ?? []).some((season) =>
    Object.values(season.weekly ?? {}).some(
      (intervals) => Array.isArray(intervals) && intervals.length > 0,
    ),
  );
  return weeklyHasHours || seasonalHasHours;
}

function ensureRules(businessId) {
  let rules = seededRules.get(businessId);
  if (!rules) {
    rules = {
      timezone: 'America/Santiago',
      weekly: {},
      seasonalSchedules: [],
      seasonalClosures: [],
      dateExceptions: [],
      temporaryClosures: [],
    };
    seededRules.set(businessId, rules);
  }
  return rules;
}

function operationalProjection(rules, now = new Date()) {
  const clock = localClock(rules.timezone, now);
  const nowMs = now.getTime();
  const temporary = (rules.temporaryClosures ?? []).find((closure) => {
    const from = Date.parse(closure.effectiveFrom);
    const until = Date.parse(closure.effectiveUntil);
    return Number.isFinite(from) && Number.isFinite(until) && from <= nowMs && nowMs < until;
  });
  if (temporary) {
    return {
      operational_state: 'temporarily_closed',
      local_date: clock.localDate,
      local_time: clock.localTime,
      schedule_confirmed_at: rules.confirmedAt,
      next_open_local: nextOpenLocal(rules, clock.localDate, clock.localTime),
    };
  }

  if (activeSeasonalClosure(rules, clock.localDate)) {
    return {
      operational_state: 'seasonal_closed',
      local_date: clock.localDate,
      local_time: clock.localTime,
      schedule_confirmed_at: rules.confirmedAt,
      next_open_local: nextOpenLocal(rules, clock.localDate, clock.localTime),
    };
  }

  const exception = (rules.dateExceptions ?? []).find((item) => item.date === clock.localDate);
  if (exception?.kind === 'closed_all_day') {
    return {
      operational_state: 'closed_today',
      local_date: clock.localDate,
      local_time: clock.localTime,
      schedule_confirmed_at: rules.confirmedAt,
      next_open_local: nextOpenLocal(rules, clock.localDate, clock.localTime),
    };
  }

  if (!hasConfiguredSchedule(rules) && !exception) {
    return {
      operational_state: 'unknown_or_stale',
      local_date: clock.localDate,
      local_time: clock.localTime,
      schedule_confirmed_at: rules.confirmedAt,
    };
  }

  const intervals = scheduleForDate(rules, clock.localDate);
  const minute = minuteOfDay(clock.localTime) ?? 0;
  const previousOpen = previousOvernightOpen(rules, clock.localDate, minute);
  const openNow = intervals.some((interval) => intervalContains(interval, minute)) || previousOpen;
  const state = openNow
    ? 'open_now'
    : intervals.length === 0 && !previousOpen
      ? 'closed_today'
      : 'closed_now';
  return {
    operational_state: state,
    local_date: clock.localDate,
    local_time: clock.localTime,
    schedule_confirmed_at: rules.confirmedAt,
    ...(openNow ? {} : { next_open_local: nextOpenLocal(rules, clock.localDate, clock.localTime) }),
  };
}

function applyProjectionToBusiness(business, projection) {
  business.operational_state = projection.operational_state;
  business.operational_confirmed_at = projection.schedule_confirmed_at;
  const labels = {
    open_now: 'Abierto ahora',
    closed_now: 'Cerrado ahora',
    closed_today: 'Cerrado hoy',
    temporarily_closed: 'Cerrado temporalmente',
    seasonal_closed: 'Cerrado por temporada',
    unknown_or_stale: 'Horario por confirmar',
  };
  business.opening_status = labels[projection.operational_state] ?? 'Horario por confirmar';
}

export function refreshBusinessOperationalState(business, now = new Date()) {
  const rules = ensureRules(business.id);
  const projection = operationalProjection(rules, now);
  applyProjectionToBusiness(business, projection);
  return projection;
}

function responseFor(business) {
  const rules = ensureRules(business.id);
  const projection = refreshBusinessOperationalState(business);
  return {
    business_id: business.id,
    rules,
    projection,
  };
}

function replaceTodayException(rules, localDate, nextException) {
  rules.dateExceptions = [
    ...(rules.dateExceptions ?? []).filter((item) => item.date !== localDate),
    ...(nextException ? [nextException] : []),
  ];
}

function findBusiness(id, businesses, res, json) {
  const business = businesses.find((item) => item.id === id);
  if (!business) json(res, 404, { error: 'business_not_found' });
  return business;
}

function requireOwnerManaged(business, res, json) {
  if (isOwnerManaged(business)) return true;
  json(res, 403, { error: 'owner_claim_required' });
  return false;
}

export async function handleOperatingRulesRequest({ req, res, url, businesses, json, readJson }) {
  const readMatch = req.method === 'GET'
    ? url.pathname.match(/^\/v1\/business\/([^/]+)\/operating-rules$/)
    : null;
  if (readMatch) {
    const id = decodeURIComponent(readMatch[1]);
    const business = findBusiness(id, businesses, res, json);
    if (!business) return true;
    json(res, 200, responseFor(business));
    return true;
  }

  const weeklyMatch = req.method === 'PUT'
    ? url.pathname.match(/^\/v1\/business\/([^/]+)\/operating-rules\/weekly$/)
    : null;
  if (weeklyMatch) {
    const id = decodeURIComponent(weeklyMatch[1]);
    const business = findBusiness(id, businesses, res, json);
    if (!business || !requireOwnerManaged(business, res, json)) return true;
    const body = await readJson(req);
    if (typeof body.timezone !== 'string' || !body.timezone.trim()) {
      json(res, 400, { error: 'timezone_required' });
      return true;
    }
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: body.timezone }).format(new Date());
    } catch {
      json(res, 400, { error: 'invalid_timezone' });
      return true;
    }
    if (!validWeekly(body.weekly)) {
      json(res, 400, { error: 'invalid_weekly_schedule' });
      return true;
    }
    const rules = ensureRules(id);
    rules.timezone = body.timezone;
    rules.weekly = body.weekly;
    rules.confirmedAt = new Date().toISOString();
    json(res, 200, responseFor(business));
    return true;
  }

  const seasonMatch = url.pathname.match(
    /^\/v1\/business\/([^/]+)\/operating-rules\/seasons\/([^/]+)$/,
  );
  if (seasonMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
    const id = decodeURIComponent(seasonMatch[1]);
    const seasonId = decodeURIComponent(seasonMatch[2]);
    const business = findBusiness(id, businesses, res, json);
    if (!business || !requireOwnerManaged(business, res, json)) return true;
    const rules = ensureRules(id);
    if (req.method === 'DELETE') {
      rules.seasonalSchedules = (rules.seasonalSchedules ?? []).filter((item) => item.id !== seasonId);
    } else {
      const body = await readJson(req);
      if (!validMonthDay(body.starts_on) || !validMonthDay(body.ends_on) || !validWeekly(body.weekly)) {
        json(res, 400, { error: 'invalid_seasonal_schedule' });
        return true;
      }
      rules.seasonalSchedules = [
        ...(rules.seasonalSchedules ?? []).filter((item) => item.id !== seasonId),
        { id: seasonId, startsOn: body.starts_on, endsOn: body.ends_on, weekly: body.weekly },
      ];
    }
    rules.confirmedAt = new Date().toISOString();
    json(res, 200, responseFor(business));
    return true;
  }

  const seasonalClosureMatch = url.pathname.match(
    /^\/v1\/business\/([^/]+)\/operating-rules\/seasonal-closures\/([^/]+)$/,
  );
  if (seasonalClosureMatch && (req.method === 'PUT' || req.method === 'DELETE')) {
    const id = decodeURIComponent(seasonalClosureMatch[1]);
    const closureId = decodeURIComponent(seasonalClosureMatch[2]);
    const business = findBusiness(id, businesses, res, json);
    if (!business || !requireOwnerManaged(business, res, json)) return true;
    const rules = ensureRules(id);
    if (req.method === 'DELETE') {
      rules.seasonalClosures = (rules.seasonalClosures ?? []).filter((item) => item.id !== closureId);
    } else {
      const body = await readJson(req);
      if (!validMonthDay(body.starts_on) || !validMonthDay(body.ends_on)) {
        json(res, 400, { error: 'invalid_seasonal_closure' });
        return true;
      }
      const confirmedAt = new Date().toISOString();
      rules.seasonalClosures = [
        ...(rules.seasonalClosures ?? []).filter((item) => item.id !== closureId),
        { id: closureId, startsOn: body.starts_on, endsOn: body.ends_on, confirmedAt },
      ];
      rules.confirmedAt = confirmedAt;
      json(res, 200, responseFor(business));
      return true;
    }
    rules.confirmedAt = new Date().toISOString();
    json(res, 200, responseFor(business));
    return true;
  }

  const quickMatch = req.method === 'POST'
    ? url.pathname.match(/^\/v1\/business\/([^/]+)\/operating-rules\/quick-action$/)
    : null;
  if (!quickMatch) return false;

  const id = decodeURIComponent(quickMatch[1]);
  const business = findBusiness(id, businesses, res, json);
  if (!business || !requireOwnerManaged(business, res, json)) return true;

  const rules = ensureRules(id);
  const body = await readJson(req);
  const confirmedAt = new Date().toISOString();
  const clock = localClock(rules.timezone);

  if (body.action === 'close_today') {
    replaceTodayException(rules, clock.localDate, {
      date: clock.localDate,
      kind: 'closed_all_day',
      confirmedAt,
    });
  } else if (body.action === 'clear_today_exception') {
    replaceTodayException(rules, clock.localDate, null);
  } else if (body.action === 'set_today_hours') {
    if (!validIntervals(body.intervals)) {
      json(res, 400, { error: 'invalid_today_intervals' });
      return true;
    }
    replaceTodayException(rules, clock.localDate, {
      date: clock.localDate,
      kind: 'custom_hours',
      intervals: body.intervals,
      confirmedAt,
    });
  } else if (body.action === 'close_temporarily') {
    const until = typeof body.effective_until === 'string' ? Date.parse(body.effective_until) : NaN;
    if (!Number.isFinite(until) || until <= Date.now()) {
      json(res, 400, { error: 'future_effective_until_required' });
      return true;
    }
    rules.temporaryClosures = [
      ...(rules.temporaryClosures ?? []).filter((item) => item.id !== 'owner-temporary'),
      {
        id: 'owner-temporary',
        effectiveFrom: confirmedAt,
        effectiveUntil: new Date(until).toISOString(),
        confirmedAt,
      },
    ];
  } else if (body.action === 'clear_temporary_closure') {
    if (typeof body.closure_id !== 'string' || !body.closure_id.trim()) {
      json(res, 400, { error: 'closure_id_required' });
      return true;
    }
    rules.temporaryClosures = (rules.temporaryClosures ?? []).filter(
      (item) => item.id !== body.closure_id,
    );
  } else {
    json(res, 400, { error: 'unsupported_operating_action' });
    return true;
  }

  rules.confirmedAt = confirmedAt;
  json(res, 200, responseFor(business));
  return true;
}
