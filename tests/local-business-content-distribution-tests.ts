import {
  buildBusinessContentDistributionPlan,
  distributionTargetsRequiringWork,
} from '../src/business/businessContentDistribution.js';
import type { BasicBusinessPost } from '../src/business/businessBasicPost.js';
import type {
  BusinessChannelConnection,
  BusinessChannelEntitlementSnapshot,
} from '../src/business/businessChannelConnection.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const post: BasicBusinessPost = {
  id: 'post-1',
  businessId: 'biz-1',
  title: 'Abrimos este sábado',
  body: 'De 10:00 a 14:00.',
  status: 'published',
  publishedAt: '2026-09-17T12:00:00-03:00',
  publishedByVerifiedOwnerAt: '2026-09-17T12:00:00-03:00',
};

const linkOnlyInstagram: BusinessChannelConnection = {
  businessId: 'biz-1',
  provider: 'instagram',
  level: 'link_only',
  status: 'active',
  accountKind: 'personal',
  publicUrl: 'https://www.instagram.com/example/',
  capabilities: ['public_link'],
};

const assistedInstagram: BusinessChannelConnection = {
  businessId: 'biz-1',
  provider: 'instagram',
  level: 'assisted_share',
  status: 'active',
  accountKind: 'personal',
  publicUrl: 'https://www.instagram.com/example/',
  capabilities: ['public_link', 'assisted_share'],
};

const connectedInstagram: BusinessChannelConnection = {
  businessId: 'biz-1',
  provider: 'instagram',
  level: 'connected_publish',
  status: 'active',
  accountKind: 'professional',
  publicUrl: 'https://www.instagram.com/example/',
  externalAccountRef: 'provider-private-ref',
  authorizedAt: '2026-09-17T11:00:00-03:00',
  capabilities: ['public_link', 'publish_content'],
};

const connectedFacebook: BusinessChannelConnection = {
  businessId: 'biz-1',
  provider: 'facebook',
  level: 'connected_publish',
  status: 'active',
  accountKind: 'page',
  publicUrl: 'https://www.facebook.com/example',
  externalAccountRef: 'provider-private-page-ref',
  authorizedAt: '2026-09-17T11:00:00-03:00',
  capabilities: ['public_link', 'publish_content'],
};

const noEntitlements: BusinessChannelEntitlementSnapshot = { grants: [] };
const assistedEntitlement: BusinessChannelEntitlementSnapshot = {
  grants: ['external_channel_assisted_share'],
};
const publishEntitlement: BusinessChannelEntitlementSnapshot = {
  grants: ['external_channel_connected_publish'],
};

const freeLinkPlan = buildBusinessContentDistributionPlan({
  post,
  connections: [linkOnlyInstagram],
  entitlements: noEntitlements,
  requestedProviders: ['instagram'],
});
assert(freeLinkPlan !== null, 'Published canonical post should be distributable as a plan.');
assert(freeLinkPlan.targets[0]?.mode === 'link_only', 'Public social link alone must remain link-only.');
assert(
  distributionTargetsRequiringWork(freeLinkPlan).length === 0,
  'Free public link must not silently create a cross-channel publishing job.',
);

const assistedPlan = buildBusinessContentDistributionPlan({
  post,
  connections: [assistedInstagram],
  entitlements: assistedEntitlement,
  requestedProviders: ['instagram'],
});
assert(assistedPlan?.targets[0]?.action === 'prepare_assisted_share', 'Eligible assisted-share channel should prepare a manual handoff.');

const automaticPlan = buildBusinessContentDistributionPlan({
  post,
  connections: [connectedInstagram, connectedFacebook],
  entitlements: publishEntitlement,
  requestedProviders: ['instagram', 'facebook'],
});
assert(automaticPlan?.targets.length === 2, 'Requested eligible connected channels should each get one target.');
assert(
  automaticPlan?.targets.every((target) => target.action === 'enqueue_publish'),
  'Connected publish requires provider readiness and active commercial entitlement.',
);
assert(
  automaticPlan?.targets.every(
    (target) =>
      !('externalAccountRef' in target) &&
      !('authorizedAt' in target) &&
      !('capabilities' in target),
  ),
  'Distribution plan must not copy provider credentials/account refs/capability internals.',
);
assert(
  automaticPlan?.targets.every((target) => target.sourcePostId === 'post-1'),
  'Every channel target should reference the same canonical Palta post.',
);

const noPaidPublishPlan = buildBusinessContentDistributionPlan({
  post,
  connections: [connectedInstagram],
  entitlements: noEntitlements,
  requestedProviders: ['instagram'],
});
assert(
  noPaidPublishPlan?.targets[0]?.mode === 'link_only',
  'Losing paid publishing entitlement must fall back to the free public link rather than deleting it.',
);
assert(
  distributionTargetsRequiringWork(noPaidPublishPlan!).length === 0,
  'No entitlement means no automatic external publishing job.',
);

const missingConnectionPlan = buildBusinessContentDistributionPlan({
  post,
  connections: [],
  entitlements: publishEntitlement,
  requestedProviders: ['tiktok'],
});
assert(missingConnectionPlan?.targets[0]?.mode === 'unavailable', 'Requested provider without a connection should remain unavailable.');

const draft: BasicBusinessPost = {
  id: 'post-draft',
  businessId: 'biz-1',
  title: 'Todavía no publicar',
  status: 'draft',
};
assert(
  buildBusinessContentDistributionPlan({
    post: draft,
    connections: [connectedInstagram],
    entitlements: publishEntitlement,
    requestedProviders: ['instagram'],
  }) === null,
  'Draft content must never create an external distribution plan.',
);

console.log('PASS: Local Business content distribution planning contract');
