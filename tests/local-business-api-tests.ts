import { PaltaApiClient } from '../src/api/paltaApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let lastBody: Record<string, unknown> | null = null;
const client = new PaltaApiClient({
  baseUrl: 'https://api.test',
  fetch: async (_input, init) => {
    lastBody = init?.body ? JSON.parse(init.body) as Record<string, unknown> : null;
    return {
      ok: true,
      status: 201,
      async json() {
        return {
          business_id: 'biz-test',
          verification_status: 'claimed',
          onboarding_status: 'verification_pending',
        };
      },
    };
  },
});

await client.submitBusinessOnboarding({
  mode: 'create_new',
  businessName: 'Gasfiter ejemplo',
  ownerDescription: 'Gasfitería a domicilio',
  confirmedServiceIds: ['home.plumbing.general'],
  presenceModes: ['customer_site'],
  serviceAreaIds: ['vitacura'],
  anchorLocation: { lat: -33.39, lng: -70.57 },
  addressLabel: 'Dirección privada',
});
assert(lastBody !== null, 'Onboarding request should be sent.');
assert(!('anchor_location' in lastBody), 'Customer-site provider must not expose registration anchor.');
assert(!('address_label' in lastBody), 'Customer-site provider must not expose private address label.');

await client.submitBusinessOnboarding({
  mode: 'create_new',
  businessName: 'Café ejemplo',
  ownerDescription: 'Café de barrio',
  confirmedServiceIds: ['food.cafe'],
  presenceModes: ['storefront'],
  serviceAreaIds: [],
  anchorLocation: { lat: -33.39, lng: -70.57 },
  addressLabel: 'Av. Ejemplo 123',
});
assert(lastBody !== null && 'anchor_location' in lastBody, 'Storefront should publish its fixed location.');
assert(lastBody.address_label === 'Av. Ejemplo 123', 'Storefront address should be submitted.');

console.log('PASS: Local Business onboarding API privacy');
