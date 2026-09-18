import {
  projectBasicBusinessCoupon,
  type BasicBusinessCoupon,
} from './businessBasicCoupon.js';
import {
  projectPublicBasicBusinessPost,
  type BasicBusinessPost,
} from './businessBasicPost.js';
import type { BusinessCustomerRelationshipSnapshot } from './businessCustomerRelationship.js';

export type FollowedBusinessUpdateItem = Readonly<{
  id: string;
  businessId: string;
  businessName: string;
  kind: 'post' | 'coupon';
  title: string;
  body?: string;
  occurredAt: string;
  expiresAt?: string;
}>;

/**
 * In-app relationship feed projection for a business the consumer explicitly
 * follows. This does not decide push/marketing delivery. Shared Notification and
 * Consent remain responsible for any out-of-app or interruptive delivery.
 *
 * Keep this feed intentionally quiet: at most one current coupon and the most
 * recent public post per business. Older history remains on the Business Profile.
 */
export function projectFollowedBusinessUpdates(input: {
  businessName: string;
  relationship: BusinessCustomerRelationshipSnapshot;
  posts?: readonly BasicBusinessPost[];
  coupons?: readonly BasicBusinessCoupon[];
  now: string | Date;
}): FollowedBusinessUpdateItem[] {
  if (!input.relationship.followedAt) return [];

  const eligiblePosts = (input.posts ?? [])
    .filter((post) => post.businessId === input.relationship.businessId)
    .map((post) => ({ post, projected: projectPublicBasicBusinessPost(post) }))
    .filter(
      (entry): entry is {
        post: BasicBusinessPost;
        projected: NonNullable<ReturnType<typeof projectPublicBasicBusinessPost>>;
      } => Boolean(entry.projected),
    )
    .sort(
      (a, b) =>
        Date.parse(b.projected.publishedAt) - Date.parse(a.projected.publishedAt),
    );

  const latestPost = eligiblePosts[0];
  const postItem: FollowedBusinessUpdateItem | undefined = latestPost
    ? {
        id: `post:${latestPost.post.id}`,
        businessId: latestPost.post.businessId,
        businessName: input.businessName,
        kind: 'post',
        title: latestPost.projected.title,
        ...(latestPost.projected.body ? { body: latestPost.projected.body } : {}),
        occurredAt: latestPost.projected.publishedAt,
      }
    : undefined;

  const eligibleCoupons = (input.coupons ?? [])
    .filter((coupon) => coupon.businessId === input.relationship.businessId)
    .map((coupon) => ({
      coupon,
      projected: projectBasicBusinessCoupon({
        coupon,
        now: input.now,
        relationship: input.relationship,
      }),
    }))
    .filter((entry) => {
      if (!entry.projected) return false;
      const occurredAt = entry.coupon.startsAt ?? entry.coupon.issuedByVerifiedOwnerAt;
      return Boolean(occurredAt && Number.isFinite(Date.parse(occurredAt)));
    })
    .sort((a, b) => {
      const aAt = a.coupon.startsAt ?? a.coupon.issuedByVerifiedOwnerAt ?? '';
      const bAt = b.coupon.startsAt ?? b.coupon.issuedByVerifiedOwnerAt ?? '';
      return Date.parse(bAt) - Date.parse(aAt);
    });

  const latestCoupon = eligibleCoupons[0];
  const couponOccurredAt = latestCoupon
    ? latestCoupon.coupon.startsAt ?? latestCoupon.coupon.issuedByVerifiedOwnerAt
    : undefined;
  const couponItem: FollowedBusinessUpdateItem | undefined =
    latestCoupon?.projected && couponOccurredAt
      ? {
          id: `coupon:${latestCoupon.coupon.id}`,
          businessId: latestCoupon.coupon.businessId,
          businessName: input.businessName,
          kind: 'coupon',
          title: latestCoupon.projected.title,
          ...(latestCoupon.projected.description
            ? { body: latestCoupon.projected.description }
            : {}),
          occurredAt: couponOccurredAt,
          ...(latestCoupon.projected.expiresAt
            ? { expiresAt: latestCoupon.projected.expiresAt }
            : {}),
        }
      : undefined;

  return [couponItem, postItem]
    .filter((item): item is FollowedBusinessUpdateItem => Boolean(item))
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
