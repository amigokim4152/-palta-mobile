import type { KnowledgeEntity, PublicationState } from './contracts.js';

export type RevisionType =
  | 'correction'
  | 'clarification'
  | 'update'
  | 'translation'
  | 'localization'
  | 'extension'
  | 'source_refresh'
  | 'retire'
  | 'emergency_recall';

export type JsonScalar = string | number | boolean | null;
export type PatchValue = JsonScalar | PatchValue[] | { [key: string]: PatchValue };

export interface KnowledgePatchOperation {
  op: 'add' | 'replace' | 'remove';
  path: string;
  value?: PatchValue;
}

export interface KnowledgeRevision {
  id: string;
  entityId: string;
  baseVersion: number;
  revisionType: RevisionType;
  operations: KnowledgePatchOperation[];
  actorType: 'human' | 'ai' | 'system';
  actorRef: string;
  createdAt: string;
  state: 'draft' | 'validated' | 'approved' | 'rejected' | 'published';
  validationNotes: string[];
}

export interface RevisionConflict {
  code: 'BASE_VERSION_MISMATCH';
  entityId: string;
  expectedBaseVersion: number;
  currentVersion: number;
}

export function revisionConflict(
  entity: Pick<KnowledgeEntity, 'id' | 'version'>,
  revision: Pick<KnowledgeRevision, 'entityId' | 'baseVersion'>,
): RevisionConflict | undefined {
  if (entity.id === revision.entityId && entity.version === revision.baseVersion) return undefined;
  return {
    code: 'BASE_VERSION_MISMATCH',
    entityId: revision.entityId,
    expectedBaseVersion: revision.baseVersion,
    currentVersion: entity.version,
  };
}

const allowedPublicationTransitions: Record<PublicationState, PublicationState[]> = {
  draft: ['in_review', 'withdrawn'],
  in_review: ['draft', 'validated', 'withdrawn'],
  validated: ['in_review', 'published', 'withdrawn'],
  published: ['withdrawn'],
  withdrawn: ['draft'],
};

export function canTransitionPublication(from: PublicationState, to: PublicationState): boolean {
  return allowedPublicationTransitions[from].includes(to);
}
