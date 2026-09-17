import {
  projectPublicBasicBusinessPost,
  type BasicBusinessPost,
} from './businessBasicPost.js';
import {
  resolveContentDistributionMode,
  type BusinessChannelConnection,
  type BusinessChannelEntitlementSnapshot,
  type PublicBusinessChannelProvider,
} from './businessChannelConnection.js';

export type BusinessContentDistributionAction =
  | 'enqueue_publish'
  | 'prepare_assisted_share'
  | 'keep_public_link'
  | 'unavailable';

export type BusinessContentDistributionTarget = Readonly<{
  businessId: string;
  sourcePostId: string;
  provider: PublicBusinessChannelProvider;
  mode: 'automatic' | 'assisted' | 'link_only' | 'unavailable';
  action: BusinessContentDistributionAction;
}>;

export type BusinessContentDistributionPlan = Readonly<{
  businessId: string;
  sourcePostId: string;
  requestedProviders: readonly PublicBusinessChannelProvider[];
  targets: readonly BusinessContentDistributionTarget[];
}>;

function actionForMode(
  mode: BusinessContentDistributionTarget['mode'],
): BusinessContentDistributionAction {
  switch (mode) {
    case 'automatic':
      return 'enqueue_publish';
    case 'assisted':
      return 'prepare_assisted_share';
    case 'link_only':
      return 'keep_public_link';
    case 'unavailable':
      return 'unavailable';
  }
}

/**
 * Build an external-channel distribution plan from one canonical Palta post.
 *
 * This function deliberately does not copy OAuth tokens, provider account ids or
 * rendered content into the plan. Adapters may resolve the canonical post by
 * sourcePostId when they execute a target. Publishing to an external channel is
 * never inferred merely because the Business has a public social link.
 *
 * Provider eligibility is supplied through BusinessChannelConnection. Vendor
 * rules change over time, so this domain planner does not hard-code assumptions
 * such as which Instagram account kinds are currently publishable.
 */
export function buildBusinessContentDistributionPlan(input: {
  post: BasicBusinessPost;
  connections: readonly BusinessChannelConnection[];
  entitlements: BusinessChannelEntitlementSnapshot;
  requestedProviders: readonly PublicBusinessChannelProvider[];
}): BusinessContentDistributionPlan | null {
  const publicPost = projectPublicBasicBusinessPost(input.post);
  if (!publicPost) return null;

  const requestedProviders = [...new Set(input.requestedProviders)];
  const targets: BusinessContentDistributionTarget[] = [];

  for (const provider of requestedProviders) {
    const connection = input.connections.find(
      (candidate) =>
        candidate.businessId === input.post.businessId &&
        candidate.provider === provider,
    );

    const mode = connection
      ? resolveContentDistributionMode(connection, input.entitlements)
      : 'unavailable';

    targets.push({
      businessId: input.post.businessId,
      sourcePostId: publicPost.id,
      provider,
      mode,
      action: actionForMode(mode),
    });
  }

  return {
    businessId: input.post.businessId,
    sourcePostId: publicPost.id,
    requestedProviders,
    targets,
  };
}

/** Only targets that actually require cross-channel work enter a queue. */
export function distributionTargetsRequiringWork(
  plan: BusinessContentDistributionPlan,
): BusinessContentDistributionTarget[] {
  return plan.targets.filter(
    (target) =>
      target.action === 'enqueue_publish' ||
      target.action === 'prepare_assisted_share',
  );
}
