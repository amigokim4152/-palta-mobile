import { createPaltaApiClient } from '../src/api/paltaApiFactory.js';
import {
  authBrokerUserId,
  paltaUserIdFromAuthBrokerUserId,
} from '../src/auth/accountModel.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function currentMethod(value: string): string {
  return String(value);
}

const response = {
  business_id: 'biz-test',
  rules: {
    timezone: 'America/Santiago',
    confirmedAt: '2026-09-17T14:00:00Z',
    weekly: {
      monday: [{ opensAt: '09:00', closesAt: '18:00' }],
    },
  },
  projection: {
    operational_state: 'closed_today',
    local_date: '2026-09-17',
    local_time: '11:00',
    schedule_confirmed_at: '2026-09-17T14:00:00Z',
    next_open_local: { localDate: '2026-09-21', localTime: '09:00' },
  },
};

let requestedPath = '';
let requestedMethod = '';
let requestedBody: Record<string, unknown> | null = null;
let authorization = '';
const authUserId = authBrokerUserId('user-test');
const client = createPaltaApiClient({
  baseUrl: 'https://api.test',
  auth: {
    async getState() {
      return {
        status: 'signed_in' as const,
        session: {
          authUserId,
          paltaUserId: paltaUserIdFromAuthBrokerUserId(authUserId),
          accessToken: 'token-test',
        },
      };
    },
    async getAccessToken() {
      return 'token-test';
    },
    async signOut() {},
    subscribe() {
      return () => {};
    },
  },
  fetch: async (input, init) => {
    requestedPath = input;
    requestedMethod = init?.method ?? 'GET';
    authorization = init?.headers?.Authorization ?? '';
    requestedBody = init?.body
      ? JSON.parse(init.body) as Record<string, unknown>
      : null;
    return {
      ok: true,
      status: 200,
      async json() {
        return response;
      },
    };
  },
});

assert(client.operatingRules !== undefined, 'Canonical API factory should expose the operating-rules domain client.');

const current = await client.operatingRules.get('biz-test');
assert(
  requestedPath.endsWith('/v1/business/biz-test/operating-rules'),
  'Owner hours must use the business-scoped operating-rules endpoint.',
);
assert(currentMethod(requestedMethod) === 'GET', 'Reading operating rules should use GET.');
assert(authorization === 'Bearer token-test', 'Operating rules should reuse the canonical auth token source.');
assert(current.projection.operational_state === 'closed_today', 'Operating-rules response should expose the normalized consumer state.');

await client.operatingRules.replaceWeeklySchedule('biz-test', {
  timezone: 'America/Santiago',
  weekly: {
    friday: [{ opensAt: '12:00', closesAt: '20:00' }],
    saturday: [{ opensAt: '12:00', closesAt: '20:00' }],
    sunday: [{ opensAt: '12:00', closesAt: '20:00' }],
  },
});
assert(
  requestedPath.endsWith('/v1/business/biz-test/operating-rules/weekly'),
  'Weekly schedule replacement should use its own idempotent endpoint.',
);
assert(currentMethod(requestedMethod) === 'PUT', 'Weekly schedule replacement should use PUT.');
assert(requestedBody?.['timezone'] === 'America/Santiago', 'Weekly schedule request must carry an IANA timezone.');
const weekly = requestedBody?.['weekly'] as Record<string, unknown> | undefined;
assert(weekly?.['friday'] !== undefined, 'Weekly schedule request should preserve the owner-confirmed days.');
assert(!('confirmed_at' in (requestedBody ?? {})), 'Client must not self-assert server confirmation timestamps.');

await client.operatingRules.upsertSeasonalSchedule('biz-test', 'low-season', {
  startsOn: '05-01',
  endsOn: '08-31',
  weekly: {
    friday: [{ opensAt: '12:00', closesAt: '20:00' }],
    saturday: [{ opensAt: '12:00', closesAt: '20:00' }],
    sunday: [{ opensAt: '12:00', closesAt: '20:00' }],
  },
});
assert(
  requestedPath.endsWith('/v1/business/biz-test/operating-rules/seasons/low-season'),
  'Recurring seasonal schedule should use its own resource path.',
);
assert(currentMethod(requestedMethod) === 'PUT', 'Seasonal schedule upsert should use PUT.');
assert(requestedBody?.['starts_on'] === '05-01' && requestedBody?.['ends_on'] === '08-31', 'Seasonal API should use recurring month-day boundaries.');
assert(!('confirmed_at' in (requestedBody ?? {})), 'Seasonal client must not self-assert confirmation evidence.');

await client.operatingRules.removeSeasonalSchedule('biz-test', 'low-season');
assert(
  requestedPath.endsWith('/v1/business/biz-test/operating-rules/seasons/low-season'),
  'Removing a season should address the same season resource.',
);
assert(currentMethod(requestedMethod) === 'DELETE', 'Removing a seasonal schedule should use DELETE.');

await client.operatingRules.upsertSeasonalClosure('biz-test', 'winter-closure', {
  startsOn: '06-01',
  endsOn: '07-15',
});
assert(
  requestedPath.endsWith('/v1/business/biz-test/operating-rules/seasonal-closures/winter-closure'),
  'Recurring full closures should be separate from alternate seasonal schedules.',
);
assert(currentMethod(requestedMethod) === 'PUT', 'Seasonal closure upsert should use PUT.');
assert(requestedBody?.['starts_on'] === '06-01', 'Seasonal closure should carry recurring month-day boundaries.');

await client.operatingRules.removeSeasonalClosure('biz-test', 'winter-closure');
assert(currentMethod(requestedMethod) === 'DELETE', 'Removing a seasonal closure should use DELETE.');

await client.operatingRules.quickAction('biz-test', { action: 'close_today' });
assert(
  requestedPath.endsWith('/v1/business/biz-test/operating-rules/quick-action'),
  'Today exceptions should use the quick-action endpoint rather than rewriting the weekly schedule.',
);
assert(currentMethod(requestedMethod) === 'POST', 'Owner quick actions are commands and should use POST.');
assert(requestedBody?.['action'] === 'close_today', 'Quick action should send only the requested owner intent.');

await client.operatingRules.quickAction('biz-test', {
  action: 'set_today_hours',
  intervals: [{ opensAt: '12:00', closesAt: '16:00' }],
});
assert(Array.isArray(requestedBody?.['intervals']), 'Today custom-hours action should carry intervals.');

await client.operatingRules.quickAction('biz-test', {
  action: 'close_temporarily',
  effectiveUntil: '2026-09-25T15:00:00Z',
});
assert(
  requestedBody?.['effective_until'] === '2026-09-25T15:00:00Z',
  'Temporary closure should send an explicit end instant, not an ambiguous duration.',
);

console.log('PASS: Local Business operating rules API contract');
