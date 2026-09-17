import { BusinessLocationApiClient } from '../src/api/businessLocationApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const calls: Array<{ url: string; init?: { method?: string; headers?: Record<string, string>; body?: string } }> = [];
let mode: 'read' | 'write' = 'read';

const client = new BusinessLocationApiClient({
  baseUrl: 'https://api.test',
  getAccessToken: async () => 'location-token',
  fetch: async (url, init) => {
    calls.push({ url, ...(init ? { init } : {}) });
    const payload = mode === 'read'
      ? {
          business_id: 'biz-1',
          address_label: 'Av. Ejemplo 123, Vitacura',
          anchor_point: { latitude: -33.39, longitude: -70.57, accuracy_m: 12 },
          public_precision: 'exact',
          service_area_labels: ['Vitacura'],
          updated_at: '2026-09-17T12:00:00-03:00',
        }
      : {
          business_id: 'biz-1',
          address_label: 'Vitacura',
          anchor_point: { latitude: -33.39, longitude: -70.57, accuracy_m: 12 },
          public_precision: 'area_only',
          service_area_labels: ['Vitacura', 'Las Condes'],
          updated_at: '2026-09-17T12:05:00-03:00',
        };
    return { ok: true, status: 200, json: async () => payload };
  },
});

const read = await client.getOwnerLocation('biz-1');
assert(read.anchor_point?.latitude === -33.39, 'owner location should retain exact anchor for management');
assert(calls[0]?.init?.headers?.Authorization === 'Bearer location-token', 'owner location must require authenticated API access');

mode = 'write';
const updated = await client.updateOwnerLocation('biz-1', {
  addressLabel: 'Vitacura',
  publicPrecision: 'area_only',
  serviceAreaLabels: ['Vitacura', 'Las Condes'],
  anchorPoint: { latitude: -33.39, longitude: -70.57, accuracyM: 12 },
});
assert(updated.public_precision === 'area_only', 'owner should be able to reduce public location precision');
const writeBody = JSON.parse(calls[1]?.init?.body ?? '{}');
assert(writeBody.anchor_point.accuracy_m === 12, 'client should map Shared Location accuracy into API shape');
assert(writeBody.public_precision === 'area_only', 'privacy choice should be explicit in owner location update');
assert(!('location' in writeBody), 'client must not bypass the owner location contract with a generic public location field');

console.log('PASS: Local Business owner location API client');
