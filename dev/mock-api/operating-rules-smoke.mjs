const base = process.env.PALTA_MOCK_BASE_URL ?? 'http://127.0.0.1:8789';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(path, init) {
  const response = await fetch(`${base}${path}`, init);
  const body = await response.json();
  return { response, body };
}

const health = await json('/health');
assert(health.response.ok && health.body.ok === true, 'operating-rules mock health failed');

const businessId = 'biz-farmacia-1';
const initial = await json(`/v1/business/${businessId}/operating-rules`);
assert(initial.response.ok, 'operating rules read failed');
assert(initial.body.business_id === businessId, 'operating rules should be business-scoped');
assert(initial.body.rules.timezone === 'America/Santiago', 'mock operating rules must use the Santiago IANA timezone');
assert(initial.body.projection.schedule_confirmed_at, 'operating projection should expose confirmed schedule evidence');

const replaced = await json(`/v1/business/${businessId}/operating-rules/weekly`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    timezone: 'America/Santiago',
    weekly: {
      friday: [{ opensAt: '12:00', closesAt: '20:00' }],
      saturday: [{ opensAt: '12:00', closesAt: '20:00' }],
      sunday: [{ opensAt: '12:00', closesAt: '20:00' }],
    },
  }),
});
assert(replaced.response.ok, 'weekly operating schedule replacement failed');
assert(!replaced.body.rules.weekly.monday, 'weekly replacement should support a Fri-Sun pattern');
assert(replaced.body.rules.weekly.friday?.[0]?.opensAt === '12:00', 'weekly replacement should persist owner hours');

const lowSeason = await json(`/v1/business/${businessId}/operating-rules/seasons/low-season`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    starts_on: '05-01',
    ends_on: '08-31',
    weekly: {
      friday: [{ opensAt: '13:00', closesAt: '19:00' }],
      saturday: [{ opensAt: '13:00', closesAt: '19:00' }],
      sunday: [{ opensAt: '13:00', closesAt: '19:00' }],
    },
  }),
});
assert(lowSeason.response.ok, 'recurring low-season schedule upsert failed');
assert(lowSeason.body.rules.seasonalSchedules.length === 1, 'low season should be stored separately from normal weekly hours');
assert(lowSeason.body.rules.seasonalSchedules[0]?.startsOn === '05-01', 'low-season recurring start should persist');
assert(lowSeason.body.rules.weekly.friday?.[0]?.opensAt === '12:00', 'seasonal schedule must not rewrite normal weekly hours');

const removedLowSeason = await json(`/v1/business/${businessId}/operating-rules/seasons/low-season`, {
  method: 'DELETE',
});
assert(removedLowSeason.response.ok, 'recurring low-season schedule delete failed');
assert(removedLowSeason.body.rules.seasonalSchedules.length === 0, 'deleting low season should remove only that recurring rule');
assert(removedLowSeason.body.rules.weekly.friday?.[0]?.opensAt === '12:00', 'deleting low season must preserve normal weekly hours');

const winterClosure = await json(`/v1/business/${businessId}/operating-rules/seasonal-closures/winter-closure`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ starts_on: '06-01', ends_on: '07-15' }),
});
assert(winterClosure.response.ok, 'recurring seasonal closure upsert failed');
assert(winterClosure.body.rules.seasonalClosures.length === 1, 'seasonal full closure should be stored separately');

const removedWinterClosure = await json(`/v1/business/${businessId}/operating-rules/seasonal-closures/winter-closure`, {
  method: 'DELETE',
});
assert(removedWinterClosure.response.ok, 'recurring seasonal closure delete failed');
assert(removedWinterClosure.body.rules.seasonalClosures.length === 0, 'seasonal closure should be independently removable');

const closedToday = await json(`/v1/business/${businessId}/operating-rules/quick-action`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'close_today' }),
});
assert(closedToday.response.ok, 'close-today quick action failed');
assert(closedToday.body.projection.operational_state === 'closed_today', 'close-today must override the normal schedule only for today');
assert(closedToday.body.rules.dateExceptions.length === 1, 'close-today should persist a date exception');

const businessAfterClose = await json(`/v1/business/${businessId}`);
assert(
  businessAfterClose.body.operational_state === 'closed_today',
  'owner operating action must update the canonical Business operational projection',
);

const restoredToday = await json(`/v1/business/${businessId}/operating-rules/quick-action`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'clear_today_exception' }),
});
assert(restoredToday.response.ok, 'clear-today exception failed');
assert(restoredToday.body.rules.dateExceptions.length === 0, 'normal-today action must remove only today exception');

const specialToday = await json(`/v1/business/${businessId}/operating-rules/quick-action`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'set_today_hours',
    intervals: [{ opensAt: '12:00', closesAt: '16:00' }],
  }),
});
assert(specialToday.response.ok, 'today custom hours failed');
assert(specialToday.body.rules.dateExceptions[0]?.kind === 'custom_hours', 'today custom hours should use a date exception');

const temporary = await json(`/v1/business/${businessId}/operating-rules/quick-action`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'close_temporarily',
    effective_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }),
});
assert(temporary.response.ok, 'temporary close failed');
assert(temporary.body.projection.operational_state === 'temporarily_closed', 'temporary closure should outrank ordinary hours');
const closureId = temporary.body.rules.temporaryClosures[0]?.id;
assert(closureId, 'temporary closure should have a stable id');

const reopened = await json(`/v1/business/${businessId}/operating-rules/quick-action`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'clear_temporary_closure',
    closure_id: closureId,
  }),
});
assert(reopened.response.ok, 'temporary closure clear failed');
assert(reopened.body.rules.temporaryClosures.length === 0, 'reopen should remove temporary closure without rewriting normal weekly hours');
assert(reopened.body.rules.weekly.friday?.[0]?.opensAt === '12:00', 'reopen must preserve owner weekly schedule');

const invalidTime = await json(`/v1/business/${businessId}/operating-rules/quick-action`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'set_today_hours',
    intervals: [{ opensAt: '25:00', closesAt: '18:00' }],
  }),
});
assert(invalidTime.response.status === 400, 'invalid owner-entered times must be rejected at the HTTP boundary');

const unclaimedWrite = await json('/v1/business/biz-taller-1/operating-rules/quick-action', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'close_today' }),
});
assert(
  unclaimedWrite.response.status === 403 && unclaimedWrite.body.error === 'owner_claim_required',
  'an unclaimed business must not accept owner operating-state changes',
);

console.log('PASS: Local Business operating rules HTTP smoke');
