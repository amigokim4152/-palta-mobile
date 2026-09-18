import {
  projectFollowedBusinessUpdates,
} from '../src/business/businessFollowedUpdates.js';
import type { BasicBusinessCoupon } from '../src/business/businessBasicCoupon.js';
import type { BasicBusinessPost } from '../src/business/businessBasicPost.js';
import type { BusinessCustomerRelationshipSnapshot } from '../src/business/businessCustomerRelationship.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const follower: BusinessCustomerRelationshipSnapshot = {
  businessId: 'biz-1',
  userId: 'user-1',
  followedAt: '2026-09-17T09:00:00-03:00',
  updatedAt: '2026-09-17T09:00:00-03:00',
};
const nonFollower: BusinessCustomerRelationshipSnapshot = {
  businessId: 'biz-1',
  userId: 'user-2',
  updatedAt: '2026-09-17T09:00:00-03:00',
};

const post: BasicBusinessPost = {
  id: 'post-1',
  businessId: 'biz-1',
  title: 'Abrimos este sábado',
  body: 'De 10:00 a 14:00.',
  status: 'published',
  publishedAt: '2026-09-17T10:00:00-03:00',
  publishedByVerifiedOwnerAt: '2026-09-17T10:00:00-03:00',
};
const olderPost: BasicBusinessPost = {
  ...post,
  id: 'post-old',
  title: 'Horario de la semana pasada',
  publishedAt: '2026-09-10T10:00:00-03:00',
  publishedByVerifiedOwnerAt: '2026-09-10T10:00:00-03:00',
};

const followerCoupon: BasicBusinessCoupon = {
  id: 'coupon-1',
  businessId: 'biz-1',
  title: '10% para seguidores',
  description: 'Beneficio simple.',
  audience: 'followers',
  status: 'published',
  startsAt: '2026-09-17T11:00:00-03:00',
  expiresAt: '2026-09-30T23:59:59-03:00',
  issuedByVerifiedOwnerAt: '2026-09-17T11:00:00-03:00',
};
const olderCoupon: BasicBusinessCoupon = {
  ...followerCoupon,
  id: 'coupon-old',
  title: 'Beneficio anterior',
  startsAt: '2026-09-12T11:00:00-03:00',
  expiresAt: '2026-09-25T23:59:59-03:00',
  issuedByVerifiedOwnerAt: '2026-09-12T11:00:00-03:00',
};

const nonFollowerItems = projectFollowedBusinessUpdates({
  businessName: 'Café ejemplo',
  relationship: nonFollower,
  posts: [olderPost, post],
  coupons: [olderCoupon, followerCoupon],
  now: '2026-09-17T12:00:00-03:00',
});
assert(nonFollowerItems.length === 0, 'Non-followers must not receive relationship-feed items.');

const followerItems = projectFollowedBusinessUpdates({
  businessName: 'Café ejemplo',
  relationship: follower,
  posts: [olderPost, post],
  coupons: [olderCoupon, followerCoupon],
  now: '2026-09-17T12:00:00-03:00',
});
assert(followerItems.length === 2, 'Follower feed should stay bounded to one current coupon and one latest post per business.');
assert(followerItems[0]?.kind === 'coupon', 'Newest relationship item should appear first.');
assert(followerItems[0]?.title === '10% para seguidores', 'Newest eligible coupon should win over older coupons.');
assert(followerItems[1]?.kind === 'post', 'Latest public business post should follow newer coupon.');
assert(followerItems[1]?.title === 'Abrimos este sábado', 'Older post history should remain on the profile, not flood Siguiendo.');

const afterExpiry = projectFollowedBusinessUpdates({
  businessName: 'Café ejemplo',
  relationship: follower,
  posts: [olderPost, post],
  coupons: [followerCoupon],
  now: '2026-10-01T00:00:00-03:00',
});
assert(afterExpiry.length === 1 && afterExpiry[0]?.kind === 'post', 'Expired coupon must leave the followed feed.');

console.log('PASS: Local Business followed updates projection');
