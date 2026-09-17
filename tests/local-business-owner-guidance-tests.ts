import { buildOwnerBusinessGuidance } from '../src/business/ownerBusinessGuidance.js';
import { rankOwnerPartnerActions } from '../src/business/ownerPartnerActions.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const guidance = buildOwnerBusinessGuidance({
  businessId: 'biz-algarrobo-1',
  verificationStatus: 'verified',
  operationalState: 'unknown_or_stale',
  hoursConfirmedAt: '2025-12-01T12:00:00-03:00',
  now: '2026-09-17T08:30:00-03:00',
  maxHoursConfirmationAgeMs: 180 * 24 * 60 * 60 * 1000,
  photoCount: 0,
  hasDescription: false,
  serviceCount: 0,
  hasPublicContact: true,
  hasPublicWebPage: true,
  hasActiveBasicCoupon: false,
  channels: [],
  searchAliasOpportunities: [
    {
      alias: 'desayuno',
      evidenceRef: 'aggregate-search:algarrobo:desayuno',
      ownerConfirmedServiceMatch: true,
    },
    {
      alias: 'brunch',
      evidenceRef: 'aggregate-search:algarrobo:brunch',
      ownerConfirmedServiceMatch: false,
    },
  ],
});

const ids = new Set(guidance.map((item) => item.id));
assert(ids.has('biz-algarrobo-1:confirm-hours'), 'Stale hours should generate a free reconfirmation action.');
assert(ids.has('biz-algarrobo-1:add-photo'), 'Missing photos should generate a practical free improvement.');
assert(ids.has('biz-algarrobo-1:create-qr'), 'A public Business page should make the free QR action available.');
assert(ids.has('biz-algarrobo-1:basic-coupon'), 'Verified owner without an active coupon should get a free coupon suggestion.');
assert(ids.has('biz-algarrobo-1:connect-channel'), 'Owner with no external channel should be invited to link the channel they already use.');
assert(ids.has('biz-algarrobo-1:search-alias:desayuno'), 'Confirmed search-demand alias may produce a service-discovery improvement.');
assert(!ids.has('biz-algarrobo-1:search-alias:brunch'), 'Search demand alone must never invent a service the owner has not confirmed.');

const ranked = rankOwnerPartnerActions(guidance, guidance.length);
assert(ranked[0]?.id === 'biz-algarrobo-1:confirm-hours', 'Stale public truth should be fixed before generic profile promotion tips.');
assert(guidance.every((item) => item.commercial === 'free'), 'Baseline guidance must not manufacture an upsell when free actions solve the observed gaps.');

console.log('PASS: Local Business deterministic owner guidance');
