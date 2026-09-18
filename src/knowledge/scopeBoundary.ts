import type {
  KnowledgeContentClass,
  KnowledgeIngressDecision,
  KnowledgeStorageLane,
} from './contracts.js';

const STORAGE_LANE_BY_CONTENT_CLASS: Record<KnowledgeContentClass, KnowledgeStorageLane> = {
  durable_knowledge: 'canonical_git',
  dynamic_observation: 'dynamic_read_model',
  public_benefit: 'public_data_event_core',
  public_event: 'public_data_event_core',
  institution_state: 'public_data_event_core',
  news: 'news_system',
  private_context: 'private_store',
};

const REASON_BY_CONTENT_CLASS: Record<KnowledgeContentClass, string> = {
  durable_knowledge: 'Stable explanatory knowledge belongs in the versioned canonical Knowledge Core.',
  dynamic_observation: 'Frequently changing observations belong in a dynamic read model and may reference canonical knowledge IDs.',
  public_benefit: 'Time-bound public benefits belong in Public Data/Event Core and may link to relevant canonical knowledge.',
  public_event: 'Schedules and dated public events belong in Public Data/Event Core, not canonical knowledge.',
  institution_state: 'Current hours, availability and operational institution state belong in Public Data/Event Core.',
  news: 'News is intentionally maintained as a separate Palta system and is not ingested into canonical Knowledge Core.',
  private_context: 'Personal or relationship-specific context belongs in private storage and must never become public canonical knowledge.',
};

export function routeKnowledgeContent(contentClass: KnowledgeContentClass): KnowledgeIngressDecision {
  return {
    contentClass,
    storageLane: STORAGE_LANE_BY_CONTENT_CLASS[contentClass],
    eligibleForCanonicalKnowledge: contentClass === 'durable_knowledge',
    reason: REASON_BY_CONTENT_CLASS[contentClass],
  };
}

export function isCanonicalKnowledgeContent(contentClass: KnowledgeContentClass): boolean {
  return routeKnowledgeContent(contentClass).eligibleForCanonicalKnowledge;
}
