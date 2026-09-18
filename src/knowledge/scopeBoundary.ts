import type {
  KnowledgeContentClass,
  KnowledgeIngressDecision,
  KnowledgeStorageLane,
  RoutingStatus,
} from './contracts.js';

type RoutePolicy = {
  lane: KnowledgeStorageLane;
  status: RoutingStatus;
  overrideAllowed: boolean;
  eligibleForCanonicalKnowledge: boolean;
  reason: string;
};

/**
 * Only boundaries already decided by Palta are fixed here.
 * Everything else is a routing hint that can move later without changing the
 * datum's domain, canonical reference, provenance or validity metadata.
 */
const ROUTE_POLICY: Record<KnowledgeContentClass, RoutePolicy> = {
  durable_knowledge: {
    lane: 'canonical_git',
    status: 'fixed',
    overrideAllowed: false,
    eligibleForCanonicalKnowledge: true,
    reason: 'Durable explanatory knowledge is versioned in the canonical Knowledge Core.',
  },
  dynamic_observation: {
    lane: 'dynamic_read_model',
    status: 'provisional',
    overrideAllowed: true,
    eligibleForCanonicalKnowledge: false,
    reason: 'Current prices, availability and measurements are observations. Their final service/storage placement may change while canonical references remain stable.',
  },
  public_benefit: {
    lane: 'shared_data_unresolved',
    status: 'provisional',
    overrideAllowed: true,
    eligibleForCanonicalKnowledge: false,
    reason: 'Public benefits/programs remain shared structured data until their final runtime/service ownership is decided.',
  },
  public_event: {
    lane: 'shared_data_unresolved',
    status: 'provisional',
    overrideAllowed: true,
    eligibleForCanonicalKnowledge: false,
    reason: 'Dated cultural/public events remain shared structured data until their final runtime/service ownership is decided.',
  },
  institution_state: {
    lane: 'shared_data_unresolved',
    status: 'provisional',
    overrideAllowed: true,
    eligibleForCanonicalKnowledge: false,
    reason: 'Current institution hours/status/availability remain shared structured data until their final runtime/service ownership is decided.',
  },
  news: {
    lane: 'news_system',
    status: 'fixed',
    overrideAllowed: false,
    eligibleForCanonicalKnowledge: false,
    reason: 'News is maintained as a separate Palta system. It may reference shared data and canonical knowledge but does not own them.',
  },
  private_context: {
    lane: 'private_store',
    status: 'fixed',
    overrideAllowed: false,
    eligibleForCanonicalKnowledge: false,
    reason: 'Personal or relationship-specific context stays in private storage and never becomes public canonical knowledge.',
  },
};

export function routeKnowledgeContent(contentClass: KnowledgeContentClass): KnowledgeIngressDecision {
  const policy = ROUTE_POLICY[contentClass];
  return {
    contentClass,
    storageLane: policy.lane,
    routingStatus: policy.status,
    overrideAllowed: policy.overrideAllowed,
    eligibleForCanonicalKnowledge: policy.eligibleForCanonicalKnowledge,
    reason: policy.reason,
  };
}

export function isCanonicalKnowledgeContent(contentClass: KnowledgeContentClass): boolean {
  return routeKnowledgeContent(contentClass).eligibleForCanonicalKnowledge;
}

export function canReRouteContent(contentClass: KnowledgeContentClass): boolean {
  return routeKnowledgeContent(contentClass).overrideAllowed;
}
