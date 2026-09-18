export type KnowledgeDomain =
  | 'health'
  | 'pets'
  | 'food'
  | 'music'
  | 'art'
  | 'finance'
  | 'culture'
  | 'clothing'
  | 'hobby'
  | 'education'
  | (string & {});

export type KnowledgeKind =
  | 'principle'
  | 'mechanism'
  | 'concept'
  | 'guide'
  | 'example'
  | 'observation'
  | 'application'
  | 'misconception';

export type KnowledgeContentClass =
  | 'durable_knowledge'
  | 'dynamic_observation'
  | 'public_benefit'
  | 'public_event'
  | 'institution_state'
  | 'news'
  | 'private_context';

export type KnowledgeStorageLane =
  | 'canonical_git'
  | 'dynamic_read_model'
  | 'public_data_event_core'
  | 'news_system'
  | 'private_store';

export interface KnowledgeIngressDecision {
  contentClass: KnowledgeContentClass;
  storageLane: KnowledgeStorageLane;
  eligibleForCanonicalKnowledge: boolean;
  reason: string;
}

export type DomainMaturity = 'seed' | 'growing' | 'mature' | 'standalone';
export type PublicationState = 'draft' | 'in_review' | 'validated' | 'published' | 'withdrawn';
export type VerificationStatus =
  | 'verified'
  | 'corroborated'
  | 'needs_verification'
  | 'stale'
  | 'conflict'
  | 'rejected';

export type KnowledgeRiskTier = 'low' | 'moderate' | 'high' | 'critical';

export type RelationType =
  | 'related_to'
  | 'part_of'
  | 'depends_on'
  | 'prerequisite_for'
  | 'influenced_by'
  | 'contrasts_with'
  | 'applies_to'
  | 'relevant_for'
  | 'from_region';

export interface KnowledgeRelation {
  type: RelationType;
  targetId: string;
  note?: string;
}

export interface EvidenceRef {
  id: string;
  sourceUrl: string;
  publisher?: string;
  title?: string;
  checkedAt: string;
  validUntil?: string;
  verification: VerificationStatus;
  license?: string;
  reuseAllowed?: boolean;
}

export interface LocaleVariantState {
  locale: string;
  sourceVersion: number;
  state: 'current' | 'update_required' | 'draft';
  changedSections?: string[];
}

export interface KnowledgeSection {
  key: string;
  heading?: string;
  body: string;
}

export interface KnowledgeEntity {
  id: string;
  domain: KnowledgeDomain;
  kind: KnowledgeKind;
  version: number;
  title: string;
  summary?: string;
  sections: KnowledgeSection[];
  relations: KnowledgeRelation[];
  evidenceRefs: string[];
  locales: LocaleVariantState[];
  countryScopes: string[];
  tags: string[];
  riskTier: KnowledgeRiskTier;
  publicationState: PublicationState;
  updatedAt: string;
}

export interface KnowledgeDomainProfile {
  domain: KnowledgeDomain;
  maturity: DomainMaturity;
  canonicalEntityCount: number;
  deepGuideCount: number;
  relationCount: number;
  supportedLocales: string[];
  publicSurface?: string;
  updatedAt: string;
}
