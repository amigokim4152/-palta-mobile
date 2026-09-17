import { BusinessCorrectionsApiClient } from '../src/api/businessCorrectionsApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: Array<{ input: string; method?: string; body?: string }> = [];
const client = new BusinessCorrectionsApiClient({
  baseUrl: 'https://api.example.test',
  fetch: async (input, init) => {
    calls.push({
      input,
      ...(init?.method ? { method: init.method } : {}),
      ...(init?.body ? { body: init.body } : {}),
    });

    if (init?.method === 'POST') {
      return {
        ok: true,
        status: 202,
        async json() {
          return {
            id: 'correction-1',
            business_id: 'biz-1',
            field: 'hours',
            reason: 'outdated',
            status: 'awaiting_owner_review',
            reported_at: '2026-09-17T16:00:00-03:00',
            note: 'El sábado estaba cerrado.',
            queue_target: 'owner_review',
          };
        },
      };
    }

    if (init?.method === 'PUT') {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: 'correction-1',
            business_id: 'biz-1',
            field: 'hours',
            reason: 'outdated',
            status: 'superseded',
            reported_at: '2026-09-17T16:00:00-03:00',
            queue_target: 'owner_review',
          };
        },
      };
    }

    return {
      ok: true,
      status: 200,
      async json() {
        return {
          business_id: 'biz-1',
          items: [
            {
              id: 'correction-1',
              business_id: 'biz-1',
              field: 'hours',
              reason: 'outdated',
              status: 'awaiting_owner_review',
              reported_at: '2026-09-17T16:00:00-03:00',
              queue_target: 'owner_review',
            },
          ],
        };
      },
    };
  },
});

const submitted = await client.submitBusinessCorrection('biz-1', {
  field: 'hours',
  reason: 'outdated',
  note: 'El sábado estaba cerrado.',
});
assert(submitted.status === 'awaiting_owner_review', 'claimed business report should enter owner review');
assert(calls[0]?.method === 'POST', 'correction submit should use POST');
assert(calls[0]?.input.endsWith('/v1/business/biz-1/corrections'), 'correction submit should use canonical route');
const submittedBody = JSON.parse(calls[0]?.body ?? '{}') as Record<string, unknown>;
assert(submittedBody.field === 'hours', 'correction should preserve fact field');
assert(!('apply' in submittedBody), 'consumer correction request must not request automatic fact application');

const ownerQueue = await client.getOwnerBusinessCorrections('biz-1');
assert(ownerQueue.items.length === 1, 'owner should receive pending correction list');
assert(ownerQueue.items[0]?.queue_target === 'owner_review', 'owner queue should remain purpose-bound');

const resolved = await client.resolveOwnerBusinessCorrection('biz-1', 'correction-1', {
  resolution: 'reviewed_and_addressed',
});
assert(resolved.status === 'superseded', 'reviewed correction should close as superseded signal');
const resolutionCall = calls.find((call) => call.method === 'PUT');
assert(
  resolutionCall?.input.endsWith('/v1/business/biz-1/owner-corrections/correction-1'),
  'correction resolution should use canonical owner review route',
);
const resolutionBody = JSON.parse(resolutionCall?.body ?? '{}') as Record<string, unknown>;
assert(
  resolutionBody.resolution === 'reviewed_and_addressed',
  'resolution should describe review completion, not a fact mutation',
);
assert(!('value' in resolutionBody), 'correction resolution must not carry a canonical fact replacement');
assert(!('apply' in resolutionBody), 'correction resolution must not auto-apply reported data');

console.log('PASS: Local Business fact corrections API client');
