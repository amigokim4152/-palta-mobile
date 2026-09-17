import { PaltaApiClient } from '../src/api/paltaApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const requests: string[] = [];
const client = new PaltaApiClient({
  baseUrl: 'https://api.test',
  fetch: async (input) => {
    requests.push(input);
    if (input.endsWith('/v1/business/biz-1/basic-coupons')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { business_id: 'biz-1', items: [] };
        },
      };
    }
    if (input.endsWith('/v1/business/biz-1/owner-basic-coupon')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            business_id: 'biz-1',
            coupon: {
              id: 'coupon-followers',
              title: 'Beneficio para seguidores',
              audience: 'followers',
              expires_at: '2026-10-01T23:59:59-03:00',
            },
          };
        },
      };
    }
    throw new Error(`Unexpected request: ${input}`);
  },
});

const publicCoupons = await client.getBusinessBasicCoupons('biz-1');
assert(
  publicCoupons.items.length === 0,
  'Consumer projection may hide a follower-only coupon when the consumer is not following.',
);

const ownerCoupon = await client.getOwnerBusinessBasicCoupon('biz-1');
assert(
  ownerCoupon.coupon?.id === 'coupon-followers',
  'Owner management projection must still expose the canonical coupon configuration.',
);
assert(
  ownerCoupon.coupon?.audience === 'followers',
  'Owner projection must preserve the configured audience without pretending it is public.',
);
assert(
  requests.some((request) => request.endsWith('/owner-basic-coupon')),
  'Owner coupon state must use an owner-scoped projection rather than the consumer endpoint.',
);

console.log('PASS: Local Business owner vs consumer coupon projection');
