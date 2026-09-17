import type { BusinessVerificationStatus } from './businessActionPolicy.js';
import type { BusinessCustomerRelationshipSnapshot } from './businessCustomerRelationship.js';

export type BasicBusinessCouponAudience = 'public' | 'followers';
export type BasicBusinessCouponStatus = 'draft' | 'published' | 'revoked';

export type BasicBusinessCoupon = Readonly<{
  id: string;
  businessId: string;
  title: string;
  description?: string;
  redemptionInstruction?: string;
  audience: BasicBusinessCouponAudience;
  status: BasicBusinessCouponStatus;
  startsAt?: string;
  expiresAt?: string;
  issuedByVerifiedOwnerAt?: string;
}>;

export type PublicBasicBusinessCoupon = Readonly<{
  id: string;
  title: string;
  description?: string;
  redemptionInstruction?: string;
  expiresAt?: string;
}>;

function toMs(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateBasicBusinessCoupon(coupon: BasicBusinessCoupon): readonly string[] {
  const issues: string[] = [];
  if (!coupon.id.trim()) issues.push('coupon_id_required');
  if (!coupon.businessId.trim()) issues.push('business_id_required');
  if (!coupon.title.trim()) issues.push('coupon_title_required');

  const startsAt = toMs(coupon.startsAt);
  const expiresAt = toMs(coupon.expiresAt);
  if (coupon.startsAt && startsAt === null) issues.push('coupon_starts_at_invalid');
  if (coupon.expiresAt && expiresAt === null) issues.push('coupon_expires_at_invalid');
  if (startsAt !== null && expiresAt !== null && expiresAt <= startsAt) {
    issues.push('coupon_expiry_must_follow_start');
  }

  if (coupon.status === 'published' && !coupon.issuedByVerifiedOwnerAt) {
    issues.push('verified_owner_issue_evidence_required');
  }

  return issues;
}

export function canVerifiedOwnerPublishBasicCoupon(input: {
  verificationStatus: BusinessVerificationStatus;
  coupon: BasicBusinessCoupon;
}): boolean {
  return (
    input.verificationStatus === 'verified' &&
    validateBasicBusinessCoupon(input.coupon).length === 0
  );
}

export function isBasicBusinessCouponActive(
  coupon: BasicBusinessCoupon,
  now: string | Date,
): boolean {
  if (coupon.status !== 'published') return false;
  if (validateBasicBusinessCoupon(coupon).length > 0) return false;

  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error('coupon_now_invalid');
  const startsAt = toMs(coupon.startsAt);
  const expiresAt = toMs(coupon.expiresAt);

  if (startsAt !== null && nowMs < startsAt) return false;
  if (expiresAt !== null && nowMs >= expiresAt) return false;
  return true;
}

/**
 * Coupon visibility is separate from notification permission. A follower-only
 * coupon may be visible in the Business page/app relationship surface without
 * granting the owner permission to push a promotional notification.
 */
export function projectBasicBusinessCoupon(input: {
  coupon: BasicBusinessCoupon;
  now: string | Date;
  relationship?: BusinessCustomerRelationshipSnapshot;
}): PublicBasicBusinessCoupon | null {
  if (!isBasicBusinessCouponActive(input.coupon, input.now)) return null;
  if (input.coupon.audience === 'followers' && !input.relationship?.followedAt) {
    return null;
  }

  return {
    id: input.coupon.id,
    title: input.coupon.title,
    ...(input.coupon.description ? { description: input.coupon.description } : {}),
    ...(input.coupon.redemptionInstruction
      ? { redemptionInstruction: input.coupon.redemptionInstruction }
      : {}),
    ...(input.coupon.expiresAt ? { expiresAt: input.coupon.expiresAt } : {}),
  };
}
