import {
  PaltaApiClient,
  type FetchLike,
} from '../src/api/paltaApiClient.js';
import type { ConversationTimelinePage } from '../src/messaging/conversationTimelineService.js';
import { timelinePageToApi } from '../src/messaging/timelineApiContract.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const page: ConversationTimelinePage = {
  items: [
    {
      kind: 'message',
      sequence: 8,
      message: {
        messageId: 'message-8',
        conversationId: 'conv-1',
        scopeId: 'scope-1',
        clientMessageId: 'client-8',
        sender: {
          actorType: 'business',
          actorId: 'business-1',
          principalUserId: 'private-staff-ref',
        },
        sequence: 8,
        type: 'text',
        body: 'Va en camino.',
        createdAt: '2026-09-17T20:00:00.000Z',
      },
    },
    {
      kind: 'domain_event',
      sequence: 9,
      event: {
        projectionId: 'projection-9',
        conversationId: 'conv-1',
        scopeId: 'scope-1',
        sequence: 9,
        sourceCore: 'commerce',
        eventId: 'shipment-event-9',
        eventType: 'shipment.out_for_delivery',
        resourceType: 'shipment',
        resourceId: 'shipment-1001',
        occurredAt: '2026-09-17T20:01:00.000Z',
        projectedAt: '2026-09-17T20:01:01.000Z',
      },
    },
  ],
  nextAfterSequence: 9,
  hasMore: true,
};

const api = timelinePageToApi(page);
assert(api.items.length === 2, 'Timeline API must preserve mixed item count.');
assert(api.items[0]?.kind === 'message', 'First item must remain a human message.');
assert(api.items[1]?.kind === 'domain_event', 'Second item must remain a domain event.');
assert(api.next_after_sequence === 9 && api.has_more, 'Timeline API must preserve canonical cursor metadata.');
const serialized = JSON.stringify(api).toLowerCase();
for (const forbidden of [
  'private-staff-ref',
  'principaluserid',
  'principal_user_id',
  'phone',
  'email',
  'address',
  'share_secret',
  'payload',
]) {
  assert(!serialized.includes(forbidden), `Public timeline must not expose ${forbidden}.`);
}
assert(serialized.includes('shipment.out_for_delivery'), 'Public timeline may expose domain event type reference.');
assert(serialized.includes('shipment-1001'), 'Public timeline may expose authorized opaque resource reference.');

const calls: Array<{ url: string; method?: string; body?: string }> = [];
const fetch: FetchLike = async (url, init) => {
  calls.push({
    url,
    ...(init?.method !== undefined ? { method: init.method } : {}),
    ...(init?.body !== undefined ? { body: init.body } : {}),
  });
  return {
    ok: true,
    status: 200,
    async json() {
      return api;
    },
  };
};

const client = new PaltaApiClient({
  baseUrl: 'https://api.somospalta.cl',
  fetch,
});

const result = await client.listConversationTimeline({
  conversationId: 'conv-1',
  afterSequence: 7,
  limit: 25,
  actingActor: { actor_type: 'business', actor_id: 'business-1' },
});
assert(result.items.length === 2, 'Mobile timeline client must return mixed items.');
assert(Number(calls.length) === 1, 'Timeline read must use one API request.');
const call = calls[0]!;
assert(call.method === undefined, 'Timeline public API is read-only GET.');
assert(call.body === undefined, 'Timeline GET must not send a mutation body.');
const url = new URL(call.url);
assert(url.pathname === '/v1/messages/conversations/conv-1/timeline', 'Timeline client must use dedicated read endpoint.');
assert(url.searchParams.get('after_sequence') === '7', 'Timeline client must send canonical sequence cursor.');
assert(url.searchParams.get('limit') === '25', 'Timeline client must send explicit page limit.');
assert(url.searchParams.get('acting_actor_type') === 'business', 'Business timeline read may request visible acting actor.');
assert(url.searchParams.get('acting_actor_id') === 'business-1', 'Business timeline read must include target actor ID.');
assert(!url.searchParams.has('principal_user_id'), 'Client must never send private staff principal identity.');

console.log('Message timeline API tests passed.');
