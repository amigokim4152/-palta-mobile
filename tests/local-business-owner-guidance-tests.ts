import { buildOwnerBusinessGuidance } from '../src/business/ownerBusinessGuidance.js';
import { rankOwnerPartnerActions } from '../src/business/ownerPartnerActions.js';
import type { BusinessChannelConnection } from '../src/business/businessChannelConnection.js';

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
  pendingFactCorrectionCount: 2,
  pendingFactCorrectionFields: ['hours', 'phone'],
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
assert(ids.has('biz-algarrobo-1:review-fact-corrections'), 'Pending customer corrections should become an owner truth-maintenance task.');
assert(ids.has('biz-algarrobo-1:confirm-hours'), 'Stale hours should generate a free reconfirmation action.');
assert(ids.has('biz-algarrobo-1:add-photo'), 'Missing photos should generate a practical free improvement.');
assert(ids.has('biz-algarrobo-1:create-qr'), 'A public Business page should make the free QR action available.');
assert(ids.has('biz-algarrobo-1:basic-coupon'), 'Verified owner without an active coupon should get a free coupon suggestion.');
assert(ids.has('biz-algarrobo-1:connect-channel'), 'Owner with no public external link should be invited to add the channels they already use.');
assert(ids.has('biz-algarrobo-1:search-alias:desayuno'), 'Confirmed search-demand alias may produce a service-discovery improvement.');
assert(!ids.has('biz-algarrobo-1:search-alias:brunch'), 'Search demand alone must never invent a service the owner has not confirmed.');
assert(!ids.has('biz-algarrobo-1:cross-channel-automation'), 'Paid automation must not be suggested without observed repeated work.');

const correctionAction = guidance.find((item) => item.id === 'biz-algarrobo-1:review-fact-corrections');
assert(correctionAction?.commercial === 'free', 'Reviewing customer corrections is basic truth maintenance, not a paid feature.');
assert(correctionAction?.reason.includes('hours') && correctionAction.reason.includes('phone'), 'Correction guidance may identify the affected fact fields without auto-applying the suggested values.');

const ranked = rankOwnerPartnerActions(guidance, guidance.length);
assert(ranked[0]?.id === 'biz-algarrobo-1:review-fact-corrections', 'A live correction signal should outrank generic improvements and an ordinary stale-hours reminder.');
assert(ranked[1]?.id === 'biz-algarrobo-1:confirm-hours', 'Stale public truth should still rank before generic profile promotion tips.');
assert(guidance.every((item) => item.commercial === 'free'), 'Baseline guidance must not manufacture an upsell when free actions solve the observed gaps.');

const linkedChannels: BusinessChannelConnection[] = [
  {
    businessId: 'biz-mature-1',
    provider: 'instagram',
    level: 'link_only',
    status: 'active',
    publicUrl: 'https://instagram.com/mature',
    capabilities: ['public_link'],
  },
  {
    businessId: 'biz-mature-1',
    provider: 'facebook',
    level: 'link_only',
    status: 'active',
    publicUrl: 'https://facebook.com/mature',
    capabilities: ['public_link'],
  },
];

const matureGuidance = buildOwnerBusinessGuidance({
  businessId: 'biz-mature-1',
  verificationStatus: 'verified',
  operationalState: 'open_now',
  hoursConfirmedAt: '2026-09-10T12:00:00-03:00',
  now: '2026-09-17T08:30:00-03:00',
  maxHoursConfirmationAgeMs: 180 * 24 * 60 * 60 * 1000,
  photoCount: 4,
  hasDescription: true,
  serviceCount: 6,
  hasPublicContact: true,
  hasPublicWebPage: true,
  hasActiveBasicCoupon: true,
  channels: linkedChannels,
  repeatedCrossChannelPublishingCount7d: 4,
  hasCrossChannelAutomation: false,
});
const matureIds = new Set(matureGuidance.map((item) => item.id));
assert(!matureIds.has('biz-mature-1:connect-channel'), 'Existing public links should satisfy the free external-channel baseline without OAuth/API access.');
assert(matureIds.has('biz-mature-1:cross-channel-automation'), 'Observed repeated publishing across multiple linked channels may justify an automation suggestion.');
const automationSuggestion = matureGuidance.find((item) => item.id === 'biz-mature-1:cross-channel-automation');
assert(automationSuggestion?.commercial === 'may_be_paid', 'Cross-channel automation should be a paid-capability candidate, not part of the free link baseline.');

console.log('PASS: Local Business deterministic owner guidance');
