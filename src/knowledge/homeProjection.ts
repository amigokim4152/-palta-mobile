import type { Domain, HomeCandidate } from '../core/contracts.js';
import type { KnowledgeEntity } from './contracts.js';

const directDomains = new Set<Domain>([
  'health', 'pets', 'food', 'music', 'art', 'finance', 'culture', 'clothing', 'hobby', 'education', 'news',
]);

function toHomeDomain(domain: string): Domain {
  return directDomains.has(domain as Domain) ? (domain as Domain) : 'other';
}

export interface KnowledgeHomeProjectionInput {
  entity: KnowledgeEntity;
  locale: string;
  relevance: number;
  importance?: 0 | 1 | 2 | 3 | 4;
  reasonRelevantNow?: string;
  publicTarget?: string;
}

export function knowledgeToHomeCandidate(input: KnowledgeHomeProjectionInput): HomeCandidate {
  const { entity } = input;
  if (entity.publicationState !== 'published') {
    throw new Error(`Knowledge ${entity.id} must be published before Home projection.`);
  }

  return {
    id: `knowledge:${entity.id}:v${entity.version}:${input.locale}`,
    domain: toHomeDomain(entity.domain),
    kind: 'content',
    title: entity.title,
    summary: input.reasonRelevantNow ?? entity.summary,
    subjectRef: entity.id,
    sourceRef: `${entity.id}@v${entity.version}`,
    urgency: 0,
    importance: input.importance ?? 2,
    relevance: input.relevance,
    actionRequired: false,
    waitingState: false,
    confidence: entity.evidenceRefs.length > 0 ? 'confirmed' : 'unknown',
    freshness: 'current',
    dedupeKey: `knowledge:${entity.id}:v${entity.version}`,
    clusterKey: `knowledge:${entity.domain}`,
    deliveryHint: 'home',
    action: input.publicTarget
      ? { label: 'Ver más', target: input.publicTarget, kind: 'deeplink' }
      : undefined,
  };
}
