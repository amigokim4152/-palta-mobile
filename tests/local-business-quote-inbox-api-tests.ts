import { BusinessQuotesApiClient } from '../src/api/businessQuotesApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let requestedPath = '';
const client = new BusinessQuotesApiClient({
  baseUrl: 'https://api.example.test',
  fetch: async (input) => {
    requestedPath = input;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          business_id: 'biz-1',
          items: [
            {
              id: 'quote-1',
              care_track_id: 'care-1',
              description: 'Necesito reparar una fuga bajo el lavaplatos.',
              status: 'responses_ready',
              created_at: '2026-09-18T10:00:00-03:00',
              response: {
                id: 'response-1',
                amount_clp: 45000,
                note: 'Incluye revisión y mano de obra.',
              },
              selected: false,
              can_respond: true,
            },
          ],
        };
      },
    };
  },
});

const inbox = await client.getBusinessInbox('biz-1');
assert(
  requestedPath.endsWith('/v1/business/biz-1/quote-requests'),
  'Owner quote inbox must be scoped to the canonical Business id.',
);
assert(inbox.items.length === 1, 'Owner quote inbox should return real requests for this business.');
assert(inbox.items[0]?.response?.amount_clp === 45000, 'Owner inbox may expose only this business own response.');
assert(inbox.items[0]?.can_respond === true, 'Owner inbox should preserve whether the request still accepts a response.');
assert(!('recipient_business_ids' in (inbox.items[0] ?? {})), 'Owner inbox must not expose recipient competitors.');
assert(!('responses' in (inbox.items[0] ?? {})), 'Owner inbox must not expose competitor responses.');
assert(!('selected_business_id' in (inbox.items[0] ?? {})), 'Owner inbox must not reveal another selected business id.');

let privacyRejected = false;
const leakyClient = new BusinessQuotesApiClient({
  baseUrl: 'https://api.example.test',
  fetch: async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        business_id: 'biz-1',
        items: [
          {
            id: 'quote-leaky',
            care_track_id: 'care-leaky',
            description: 'Solicitud que no debe filtrar datos cruzados.',
            status: 'responses_ready',
            created_at: '2026-09-18T10:00:00-03:00',
            recipient_business_ids: ['biz-1', 'biz-2'],
            responses: [{ business_id: 'biz-2', amount_clp: 1 }],
            selected: false,
            can_respond: true,
          },
        ],
      };
    },
  }),
});
try {
  await leakyClient.getBusinessInbox('biz-1');
} catch {
  privacyRejected = true;
}
assert(privacyRejected, 'Client must reject any owner-inbox payload that leaks cross-business quote data.');

console.log('PASS: Local Business privacy-minimal owner quote inbox API');
