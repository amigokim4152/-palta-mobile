import type { BusinessVerificationStatus } from './businessActionPolicy.js';
import type { BusinessCustomerRelationshipSnapshot } from './businessCustomerRelationship.js';

export type BasicBusinessPostStatus = 'draft' | 'published' | 'archived';

export type BasicBusinessPost = Readonly<{
  id: string;
  businessId: string;
  title: string;
  body?: string;
  status: BasicBusinessPostStatus;
  publishedAt?: string;
  publishedByVerifiedOwnerAt?: string;
}>;

export type PublicBasicBusinessPost = Readonly<{
  id: string;
  title: string;
  body?: string;
  publishedAt: string;
}>;

export function validateBasicBusinessPost(post: BasicBusinessPost): readonly string[] {
  const issues: string[] = [];
  if (!post.id.trim()) issues.push('post_id_required');
  if (!post.businessId.trim()) issues.push('business_id_required');
  if (!post.title.trim()) issues.push('post_title_required');
  if (post.title.trim().length > 120) issues.push('post_title_too_long');
  if ((post.body ?? '').length > 2000) issues.push('post_body_too_long');

  if (post.status === 'published') {
    if (!post.publishedAt || !Number.isFinite(Date.parse(post.publishedAt))) {
      issues.push('published_at_required');
    }
    if (!post.publishedByVerifiedOwnerAt) {
      issues.push('verified_owner_publish_evidence_required');
    }
  }

  return issues;
}

export function canVerifiedOwnerPublishBasicPost(input: {
  verificationStatus: BusinessVerificationStatus;
  post: BasicBusinessPost;
}): boolean {
  return (
    input.verificationStatus === 'verified' &&
    validateBasicBusinessPost(input.post).length === 0
  );
}

export function projectPublicBasicBusinessPost(
  post: BasicBusinessPost,
): PublicBasicBusinessPost | null {
  if (post.status !== 'published') return null;
  if (validateBasicBusinessPost(post).length > 0 || !post.publishedAt) return null;
  return {
    id: post.id,
    title: post.title.trim(),
    ...(post.body?.trim() ? { body: post.body.trim() } : {}),
    publishedAt: post.publishedAt,
  };
}

/**
 * Follow controls relationship/feed eligibility only. It does not grant push or
 * marketing permission; Shared Notification/Consent still decides delivery.
 */
export function canSurfaceBasicPostInFollowerFeed(input: {
  post: BasicBusinessPost;
  relationship: BusinessCustomerRelationshipSnapshot;
}): boolean {
  return Boolean(
    input.relationship.followedAt &&
      projectPublicBasicBusinessPost(input.post),
  );
}
