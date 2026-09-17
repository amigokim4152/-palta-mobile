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

let relationshipRequestPath = '';
let relationshipRequestMethod = '';
let relationshipRequestBody: Record<string, unknown> | null = null;
const relationshipClient = new PaltaApiClient({
  baseUrl: 'https://api.test',
  fetch: async (input, init) => {
    relationshipRequestPath = input;
    relationshipRequestMethod = init?.method ?? 'GET';
    relationshipRequestBody = init?.body
      ? JSON.parse(init.body) as Record<string, unknown>
      : null;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          business_id: 'biz-test',
          saved: relationshipRequestBody?.['saved'] ?? false,
          following: relationshipRequestBody?.['following'] ?? false,
          regular_customer: false,
        };
      },
    };
  },
});
const relationship = await relationshipClient.updateBusinessRelationship('biz-test', {
  saved: true,
});
assert(
  relationshipRequestPath.endsWith('/v1/business/biz-test/relationship'),
  'Save/follow state should use a business-scoped consumer relationship endpoint.',
);
assert(relationshipRequestMethod === 'PUT', 'Relationship update should be idempotent state replacement.');
assert(relationshipRequestBody?.['saved'] === true, 'Save update should send only explicit relationship state.');
assert(!('marketing_consent' in (relationshipRequestBody ?? {})), 'Save/follow endpoint must not self-grant marketing consent.');
assert(!('notification_allowed' in (relationshipRequestBody ?? {})), 'Save/follow endpoint must not own notification permission.');
assert(relationship.saved === true && relationship.following === false, 'Save API should preserve independent relationship dimensions.');

let couponRequestPath = '';
let couponRequestMethod = '';
let couponRequestBody: Record<string, unknown> | null = null;
const couponClient = new PaltaApiClient({
  baseUrl: 'https://api.test',
  fetch: async (input, init) => {
    couponRequestPath = input;
    couponRequestMethod = init?.method ?? 'GET';
    couponRequestBody = init?.body
      ? JSON.parse(init.body) as Record<string, unknown>
      : null;
    return {
      ok: true,
      status: 200,
      async json() {
        const revoked = couponRequestBody?.['status'] === 'revoked';
        return {
          business_id: 'biz-test',
          items: revoked
            ? []
            : [{
                id: 'coupon-1',
                title: String(couponRequestBody?.['title'] ?? 'Cupón'),
                audience: couponRequestBody?.['audience'] ?? 'public',
                expires_at: couponRequestBody?.['expires_at'],
              }],
        };
      },
    };
  },
});
const couponResult = await couponClient.upsertBusinessBasicCoupon('biz-test', {
  title: '10% en tu próxima visita',
  description: 'Beneficio simple',
  redemptionInstruction: 'Muéstralo antes de pagar.',
  audience: 'followers',
  expiresAt: '2026-10-01T23:59:59-03:00',
});
assert(
  couponRequestPath.endsWith('/v1/business/biz-test/basic-coupon'),
  'Basic coupon should use the business-scoped free coupon endpoint.',
);
assert(couponRequestMethod === 'PUT', 'Basic coupon upsert should use idempotent PUT semantics.');
assert(couponRequestBody?.['audience'] === 'followers', 'Basic coupon should preserve simple audience choice.');
assert(couponRequestBody?.['redemption_instruction'] === 'Muéstralo antes de pagar.', 'Basic coupon should preserve redemption instruction.');
assert(!('segment_id' in (couponRequestBody ?? {})), 'Free basic coupon must not embed advanced segmentation.');
assert(!('automation' in (couponRequestBody ?? {})), 'Free basic coupon must not self-enable campaign automation.');
assert(!('entitlement' in (couponRequestBody ?? {})), 'Free basic coupon must not require a paid entitlement field.');
assert(couponResult.items[0]?.title === '10% en tu próxima visita', 'Basic coupon API should return the public projection.');

const revokedCoupons = await couponClient.revokeBusinessBasicCoupon('biz-test');
assert(couponRequestBody?.['status'] === 'revoked', 'Coupon revocation should be explicit and simple.');
assert(revokedCoupons.items.length === 0, 'Revoked coupon should disappear from the active projection.');

console.log('PASS: Local Business onboarding privacy + owner guidance + public links + relationship + coupon API');
