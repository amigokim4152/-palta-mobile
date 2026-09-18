import type { KnowledgeDomain, KnowledgeEntity, VerificationStatus } from './contracts.js';
import type { KnowledgePatchOperation, KnowledgeRevision, RevisionType } from './revision.js';

export interface KnowledgeSearchQuery {
  text: string;
  domains?: KnowledgeDomain[];
  country?: string;
  locale?: string;
  publishedOnly?: boolean;
  limit?: number;
}

export interface KnowledgeSearchHit {
  id: string;
  domain: KnowledgeDomain;
  title: string;
  version: number;
  score: number;
}

export interface ProposeRevisionInput {
  entityId: string;
  baseVersion: number;
  revisionType: RevisionType;
  operations: KnowledgePatchOperation[];
  actorType: 'human' | 'ai' | 'system';
  actorRef: string;
}

export interface KnowledgeValidationIssue {
  gate:
    | 'schema'
    | 'reference'
    | 'source'
    | 'freshness'
    | 'translation'
    | 'localization'
    | 'privacy'
    | 'safety'
    | 'duplicate_conflict'
    | 'render';
  severity: 'info' | 'warning' | 'error';
  message: string;
  evidenceStatus?: VerificationStatus;
}

export interface KnowledgeValidationReport {
  revisionId: string;
  passed: boolean;
  issues: KnowledgeValidationIssue[];
}

export interface KnowledgeDiff {
  revisionId: string;
  entityId: string;
  baseVersion: number;
  changedPaths: string[];
  operations: KnowledgePatchOperation[];
}

export interface KnowledgePublishResult {
  entityId: string;
  previousVersion: number;
  publishedVersion: number;
  eventType: 'canonical.changed';
}

export interface KnowledgeOpsPort {
  search(query: KnowledgeSearchQuery): Promise<KnowledgeSearchHit[]>;
  get(entityId: string, version?: number): Promise<KnowledgeEntity | undefined>;
  proposeRevision(input: ProposeRevisionInput): Promise<KnowledgeRevision>;
  validateRevision(revisionId: string): Promise<KnowledgeValidationReport>;
  diffRevision(revisionId: string): Promise<KnowledgeDiff>;
  publishRevision(revisionId: string): Promise<KnowledgePublishResult>;
  rollback(entityId: string, targetVersion: number, actorRef: string): Promise<KnowledgePublishResult>;
}

// AI clients receive this port, never unrestricted SQL or production credentials.
export const KNOWLEDGE_OPS_DIRECT_PRODUCTION_DB_ACCESS = false;
