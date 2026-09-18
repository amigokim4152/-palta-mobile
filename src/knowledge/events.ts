import type { PaltaEvent } from '../events/eventBusPort.js';

export interface CanonicalKnowledgeChangedPayload {
  knowledgeId: string;
  domain: string;
  version: number;
  previousVersion?: number;
  revisionType: string;
  publicationState: 'published' | 'withdrawn';
}

export function canonicalKnowledgeChangedEvent(
  payload: CanonicalKnowledgeChangedPayload,
  occurredAt: string,
): PaltaEvent<CanonicalKnowledgeChangedPayload> {
  return {
    id: `canonical:${payload.knowledgeId}:v${payload.version}:${payload.publicationState}`,
    type: 'canonical.changed',
    occurredAt,
    source: 'palta-knowledge',
    subjectRef: payload.knowledgeId,
    dedupeKey: `canonical:${payload.knowledgeId}:v${payload.version}:${payload.publicationState}`,
    payload,
  };
}
