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
const mobileBody = lastBody as Record<string, unknown> | null;
assert(mobileBody !== null, 'Onboarding request should be sent.');
assert(!('anchor_location' in mobileBody), 'Customer-site provider must not expose registration anchor.');
assert(!('address_label' in mobileBody), 'Customer-site provider must not expose private address label.');

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
const storefrontBody = lastBody as Record<string, unknown> | null;
assert(storefrontBody !== null, 'Storefront onboarding request should be sent.');
assert('anchor_location' in storefrontBody, 'Storefront should publish its fixed location.');
assert(storefrontBody['address_label'] === 'Av. Ejemplo 123', 'Storefront address should be submitted.');

let requestedPath = '';
const guidanceClient = new PaltaApiClient({
  baseUrl: 'https://api.test',
  fetch: async (input) => {
    requestedPath = input;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          business_id: 'biz-test',
          items: [
            {
              id: 'biz-test:confirm-hours',
              class: 'stale_or_inaccurate_truth',
              title: 'Confirma tu horario',
              reason: 'El horario necesita una confirmación reciente.',
              target: '/business/manage/biz-test/hours',
              action_required: true,
              commercial: 'free',
            },
          ],
        };
      },
    };
  },
});
const guidance = await guidanceClient.getOwnerBusinessGuidance('biz-test');
assert(
  requestedPath.endsWith('/v1/business/biz-test/owner-guidance'),
  'Owner guidance must use a business-scoped owner endpoint rather than public profile fields.',
);
assert(guidance.items[0]?.commercial === 'free', 'Owner guidance should preserve free/paid meaning from the partner policy.');
assert(guidance.items[0]?.action_required === true, 'Owner guidance should preserve whether an item actually needs attention.');

let channelRequestPath = '';
let channelRequestMethod = '';
let channelRequestBody: Record<string, unknown> | null = null;
const channelClient = new PaltaApiClient({
  baseUrl: 'https://api.test',
  fetch: async (input, init) => {
    channelRequestPath = input;
    channelRequestMethod = init?.method ?? 'GET';
    channelRequestBody = init?.body
      ? JSON.parse(init.body) as Record<string, unknown>
      : null;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          business_id: 'biz-test',
          links: [
            {
              provider: 'instagram',
              label: 'Instagram',
              url: 'https://instagram.com/biz-test',
            },
          ],
        };
      },
    };
  },
});
const channelResult = await channelClient.replaceBusinessPublicChannelLinks('biz-test', [
  { provider: 'instagram', url: 'https://instagram.com/biz-test' },
]);
assert(
  channelRequestPath.endsWith('/v1/business/biz-test/channel-links'),
  'Free external links should use a business-scoped link-management endpoint.',
);
assert(channelRequestMethod === 'PUT', 'Replacing the free public link set should be idempotent.');
const channelLinks = channelRequestBody?.['links'];
assert(Array.isArray(channelLinks), 'Channel-link request should send links[].');
const firstChannel = (channelLinks as Record<string, unknown>[])[0];
assert(firstChannel?.['provider'] === 'instagram', 'Channel-link request should send provider.');
assert(firstChannel?.['url'] === 'https://instagram.com/biz-test', 'Channel-link request should send only the public URL.');
assert(!('authorized_at' in (firstChannel ?? {})), 'Free link endpoint must not accept OAuth authorization metadata.');
assert(!('capabilities' in (firstChannel ?? {})), 'Free link endpoint must not let clients self-grant integration capabilities.');
assert(channelResult.links[0]?.provider === 'instagram', 'Channel-link response should return safe public projections.');

console.log('PASS: Local Business onboarding privacy + owner guidance + public channel-link API');
