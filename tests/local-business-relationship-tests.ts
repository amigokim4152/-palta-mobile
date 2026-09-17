import {
  applyBusinessRelationshipAction,
  canReceiveFollowedBusinessUpdate,
  projectBusinessCustomerRelationship,
  type BusinessCustomerRelationshipSnapshot,
} from '../src/business/businessCustomerRelationship.js';
import {
  canVerifiedOwnerPublishBasicCoupon,
  projectBasicBusinessCoupon,
  type BasicBusinessCoupon,
} from '../src/business/businessBasicCoupon.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

let relationship: BusinessCustomerRelationshipSnapshot = {
  businessId: 'biz-1',
  userId: 'user-1',
  updatedAt: '2026-09-17T09:00:00-03:00',
};

relationship = applyBusinessRelationshipAction({
  relationship,
  action: 'save',
  at: '2026-09-17T09:01:00-03:00',
});
assert(projectBusinessCustomerRelationship(relationship).saved, 'Save should be represented independently.');
assert(!projectBusinessCustomerRelationship(relationship).following, 'Save must not silently create follow.');

relationship = applyBusinessRelationshipAction({
  relationship,
  action: 'follow',
  at: '2026-09-17T09:02:00-03:00',
});
assert(projectBusinessCustomerRelationship(relationship).following, 'Consumer follow should be recorded explicitly.');
assert(
  !canReceiveFollowedBusinessUpdate({
    relationship,
    notificationAllowed: false,
    consentAllowedByPolicy: true,
  }),
  'Follow alone must not override notification preference.',
);
assert(
  !canReceiveFollowedBusinessUpdate({
    relationship,
    notificationAllowed: true,
    consentAllowedByPolicy: false,
  }),
  'Follow alone must not override Consent/Policy Core.',
);
assert(
  canReceiveFollowedBusinessUpdate({
    relationship,
    notificationAllowed: true,
    consentAllowedByPolicy: true,
  }),
  'Follower update is eligible only when Shared Core permission also allows delivery.',
);

relationship = applyBusinessRelationshipAction({
  relationship,
  action: 'mark_regular',
  at: '2026-09-17T09:03:00-03:00',
});
relationship = applyBusinessRelationshipAction({
  relationship,
  action: 'unfollow',
  at: '2026-09-17T09:04:00-03:00',
});
const afterUnfollow = projectBusinessCustomerRelationship(relationship);
assert(afterUnfollow.saved, 'Unfollow must not delete a separate saved relationship.');
assert(afterUnfollow.regularCustomer, 'Unfollow must not erase legitimate repeat-customer recognition.');
assert(!afterUnfollow.following, 'Unfollow should stop follower state only.');

const publicCoupon: BasicBusinessCoupon = {
  id: 'coupon-1',
  businessId: 'biz-1',
  title: '10% en tu próxima visita',
  description: 'Beneficio básico del negocio.',
  redemptionInstruction: 'Muéstralo antes de pagar.',
  audience: 'public',
  status: 'published',
  startsAt: '2026-09-17T00:00:00-03:00',
  expiresAt: '2026-09-30T23:59:59-03:00',
  issuedByVerifiedOwnerAt: '2026-09-16T18:00:00-03:00',
};
assert(
  canVerifiedOwnerPublishBasicCoupon({
    verificationStatus: 'verified',
    coupon: publicCoupon,
  }),
  'Verified owner should be able to publish a valid basic coupon without a paid entitlement.',
);
assert(
  !canVerifiedOwnerPublishBasicCoupon({
    verificationStatus: 'claimed',
    coupon: publicCoupon,
  }),
  'Claimed but unverified owner must not publish owner-controlled coupon claims.',
);
assert(
  projectBasicBusinessCoupon({
    coupon: publicCoupon,
    now: '2026-09-20T12:00:00-03:00',
  })?.id === 'coupon-1',
  'Active public coupon should project without requiring follow.',
);
assert(
  projectBasicBusinessCoupon({
    coupon: publicCoupon,
    now: '2026-10-01T00:00:00-03:00',
  }) === null,
  'Expired coupon must not remain visible.',
);

const followerCoupon: BasicBusinessCoupon = {
  ...publicCoupon,
  id: 'coupon-followers',
  audience: 'followers',
};
assert(
  projectBasicBusinessCoupon({
    coupon: followerCoupon,
    now: '2026-09-20T12:00:00-03:00',
    relationship,
  }) === null,
  'Follower-only coupon must not project after the consumer unfollows.',
);
const followedAgain = applyBusinessRelationshipAction({
  relationship,
  action: 'follow',
  at: '2026-09-20T12:01:00-03:00',
});
assert(
  projectBasicBusinessCoupon({
    coupon: followerCoupon,
    now: '2026-09-20T12:02:00-03:00',
    relationship: followedAgain,
  })?.id === 'coupon-followers',
  'Follower-only coupon may project to an explicitly following consumer.',
);

console.log('PASS: Local Business relationship + free basic coupon contracts');
