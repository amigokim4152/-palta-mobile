import { BusinessServicesApiClient } from '../src/api/businessServicesApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: Array<{ url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }> = [];
let mode: 'read' | 'write' = 'read';

const client = new BusinessServicesApiClient({
  baseUrl: 'https://api.test',
  getAccessToken: async () => 'token-123',
  fetch: async (url, init) => {
    calls.push({ url, ...(init ? { init } : {}) });
    const body = mode === 'read'
      ? {
          business_id: 'biz-1',
          items: [
            {
              service_id: 'home.plumbing.general',
              label: 'Gasfitería',
              discovery_group_key: 'HOME_REPAIR_MAINTENANCE',
            },
          ],
          pending_owner_phrases: [],
          updated_at: '2026-09-17T12:00:00-03:00',
        }
      : {
          business_id: 'biz-1',
          items: [
            {
              service_id: 'home.plumbing.drain_unclogging',
              label: 'Destape y alcantarillado',
              discovery_group_key: 'HOME_REPAIR_MAINTENANCE',
            },
          ],
          pending_owner_phrases: ['Mantención especial de cámara'],
          updated_at: '2026-09-17T12:05:00-03:00',
        };
    return { ok: true, status: 200, json: async () => body };
  },
});

const read = await client.getOwnerServices('biz-1');
assert(read.items[0]?.service_id === 'home.plumbing.general', 'owner service read should preserve canonical id');
assert(calls[0]?.init?.headers?.Authorization === 'Bearer token-123', 'owner services must use authenticated API access');

mode = 'write';
const updated = await client.updateOwnerServices('biz-1', {
  canonicalServiceIds: ['home.plumbing.drain_unclogging'],
  pendingOwnerPhrases: ['Mantención especial de cámara'],
});
assert(updated.pending_owner_phrases.length === 1, 'owner-only pending wording should round trip');
const writeBody = JSON.parse(calls[1]?.init?.body ?? '{}');
assert(writeBody.canonical_service_ids[0] === 'home.plumbing.drain_unclogging', 'write should use canonical service ids');
assert(!('service_labels' in writeBody), 'client must not author public labels independently from canonical taxonomy');

console.log('PASS: Local Business owner services API client');
