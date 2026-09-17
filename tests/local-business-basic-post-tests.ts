import {
  canSurfaceBasicPostInFollowerFeed,
  canVerifiedOwnerPublishBasicPost,
  projectPublicBasicBusinessPost,
  type BasicBusinessPost,
} from '../src/business/businessBasicPost.js';
import type { BusinessCustomerRelationshipSnapshot } from '../src/business/businessCustomerRelationship.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const published: BasicBusinessPost = {
  id: 'post-1',
  businessId: 'biz-1',
  title: 'Abrimos también este sábado',
  body: 'Atenderemos de 10:00 a 14:00.',
  status: 'published',
  publishedAt: '2026-09-17T09:30:00-03:00',
  publishedByVerifiedOwnerAt: '2026-09-17T09:30:00-03:00',
};

assert(
  canVerifiedOwnerPublishBasicPost({
    verificationStatus: 'verified',
    post: published,
  }),
  'Verified owner should be able to publish a simple free business update.',
);
assert(
  !canVerifiedOwnerPublishBasicPost({
    verificationStatus: 'claimed',
    post: published,
  }),
  'Unverified claim must not publish owner-controlled news.',
);
assert(
  projectPublicBasicBusinessPost(published)?.title === 'Abrimos también este sábado',
  'Published valid post should project to the public Business profile.',
);

const draft: BasicBusinessPost = {
  ...published,
  id: 'post-draft',
  status: 'draft',
  publishedAt: undefined,
  publishedByVerifiedOwnerAt: undefined,
};
assert(projectPublicBasicBusinessPost(draft) === null, 'Draft must never leak to the public profile.');

const follower: BusinessCustomerRelationshipSnapshot = {
  businessId: 'biz-1',
  userId: 'user-1',
  followedAt: '2026-09-17T09:35:00-03:00',
  updatedAt: '2026-09-17T09:35:00-03:00',
};
const nonFollower: BusinessCustomerRelationshipSnapshot = {
  businessId: 'biz-1',
  userId: 'user-2',
  updatedAt: '2026-09-17T09:35:00-03:00',
};
assert(
  canSurfaceBasicPostInFollowerFeed({ post: published, relationship: follower }),
  'Explicit follower may receive the post in a relationship feed.',
);
assert(
  !canSurfaceBasicPostInFollowerFeed({ post: published, relationship: nonFollower }),
  'Public post visibility must not silently create a follower relationship.',
);

const tooLong: BasicBusinessPost = {
  ...published,
  id: 'post-too-long',
  title: 'x'.repeat(121),
};
assert(
  !canVerifiedOwnerPublishBasicPost({ verificationStatus: 'verified', post: tooLong }),
  'Basic free post should enforce simple deterministic content limits.',
);

console.log('PASS: Local Business free basic post contract');
