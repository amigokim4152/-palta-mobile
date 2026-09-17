import {
  PaltaApiClient,
  type FetchLike,
} from '../src/api/paltaApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: Array<{
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}> = [];

const fetch: FetchLike = async (url, init) => {
  calls.push({
    url,
    ...(init?.method !== undefined ? { method: init.method } : {}),
    ...(init?.headers !== undefined ? { headers: init.headers } : {}),
    ...(init?.body !== undefined ? { body: init.body } : {}),
  });

  if (url.includes('/businesses/business-1/conversation')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          conversation_id: '00000000-0000-4000-8000-000000000001',
          conversation_type: 'business',
          last_sequence: 4,
          last_activity_at: '2026-09-17T20:30:00.000Z',
          created_at: '2026-09-17T18:00:00.000Z',
          created: false,
        };
      },
    };
  }

  if (url.includes('/v1/messages/conversations?')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          items: [],
          next_cursor: {
            last_activity_at: '2026-09-17T20:00:00.000Z',
            conversation_id: '00000000-0000-4000-8000-000000000002',
          },
        };
      },
    };
  }

  throw new Error(`Unexpected URL ${url}`);
};

const client = new PaltaApiClient({
  baseUrl: 'https://api.somospalta.cl/',
  fetch,
  getAccessToken: async () => 'access-token-test',
});

const opened = await client.openBusinessConversation('business-1');
assert(opened.created === false, 'Mobile client must preserve open/reuse result.');
assert(Number(calls.length) === 1, 'Opening a business conversation must make one API request.');
const openCall = calls[0]!;
assert(openCall.method === 'POST', 'Business conversation open must use POST.');
assert(openCall.url.endsWith('/v1/messages/businesses/business-1/conversation'), 'Business ID must be encoded in relationship endpoint.');
assert(openCall.body === '{}', 'User-business open request must not send customer identity in body.');
const openSerialized = `${openCall.url} ${openCall.body}`.toLowerCase();
for (const forbidden of ['user-1', 'phone', 'email', 'address', 'principal_user_id']) {
  assert(!openSerialized.includes(forbidden), `Open conversation request must not contain ${forbidden}.`);
}
assert(openCall.headers?.Authorization === 'Bearer access-token-test', 'Authenticated session must identify the user.');

await client.listConversationInbox({
  limit: 25,
  actingActor: { actor_type: 'business', actor_id: 'business-1' },
  cursor: {
    lastActivityAt: '2026-09-17T20:30:00.000Z',
    conversationId: '00000000-0000-4000-8000-000000000001',
  },
});
assert(Number(calls.length) === 2, 'Inbox load must make one additional request.');
const inboxUrl = new URL(calls[1]!.url);
assert(inboxUrl.pathname === '/v1/messages/conversations', 'Inbox must use relationship conversation collection endpoint.');
assert(inboxUrl.searchParams.get('limit') === '25', 'Inbox limit must be explicit.');
assert(inboxUrl.searchParams.get('acting_actor_type') === 'business', 'Business staff Inbox must request visible business actor.');
assert(inboxUrl.searchParams.get('acting_actor_id') === 'business-1', 'Business staff Inbox must request the target business actor ID.');
assert(inboxUrl.searchParams.get('after_activity') === '2026-09-17T20:30:00.000Z', 'Inbox cursor must include last activity timestamp.');
assert(inboxUrl.searchParams.get('after_conversation_id') === '00000000-0000-4000-8000-000000000001', 'Inbox cursor must include tie-break conversation ID.');
assert(!inboxUrl.searchParams.has('principal_user_id'), 'Client must never send employee principal identity as a query parameter.');

console.log('Message mobile client tests passed.');
