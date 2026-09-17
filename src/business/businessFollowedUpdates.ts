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
 */
export function projectFollowedBusinessUpdates(input: {
  businessName: string;
  relationship: BusinessCustomerRelationshipSnapshot;
  posts?: readonly BasicBusinessPost[];
  coupons?: readonly BasicBusinessCoupon[];
  now: string | Date;
}): FollowedBusinessUpdateItem[] {
  if (!input.relationship.followedAt) return [];

  const items: FollowedBusinessUpdateItem[] = [];

  for (const post of input.posts ?? []) {
    if (post.businessId !== input.relationship.businessId) continue;
    const projected = projectPublicBasicBusinessPost(post);
    if (!projected) continue;
    items.push({
      id: `post:${post.id}`,
      businessId: post.businessId,
      businessName: input.businessName,
      kind: 'post',
      title: projected.title,
      ...(projected.body ? { body: projected.body } : {}),
      occurredAt: projected.publishedAt,
    });
  }

  for (const coupon of input.coupons ?? []) {
    if (coupon.businessId !== input.relationship.businessId) continue;
    const projected = projectBasicBusinessCoupon({
      coupon,
      now: input.now,
      relationship: input.relationship,
    });
    if (!projected) continue;
    const occurredAt = coupon.startsAt ?? coupon.issuedByVerifiedOwnerAt;
    if (!occurredAt || !Number.isFinite(Date.parse(occurredAt))) continue;
    items.push({
      id: `coupon:${coupon.id}`,
      businessId: coupon.businessId,
      businessName: input.businessName,
      kind: 'coupon',
      title: projected.title,
      ...(projected.description ? { body: projected.description } : {}),
      occurredAt,
      ...(projected.expiresAt ? { expiresAt: projected.expiresAt } : {}),
    });
  }

  return items.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}
