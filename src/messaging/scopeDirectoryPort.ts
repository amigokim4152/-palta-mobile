import type {
  ConversationScope,
  ConversationScopeResourceRef,
  ResourceRef,
  ScopeAccessMode,
} from './contracts.js';

export interface EnsureConversationScopeInput {
  scopeId: string;
  conversationId: string;
  scopeType: string;
  label?: string;
  sourceCore: string;
  primaryResource: ResourceRef;
  authorizationEvidenceRef: string;
  accessMode: ScopeAccessMode;
  createdAt: string;
}

export interface EnsureConversationScopeResult {
  scope: ConversationScope;
  primaryResource: ConversationScopeResourceRef;
  created: boolean;
}

export interface ConversationScopeDirectoryPort {
  ensureForPrimaryResource(
    input: EnsureConversationScopeInput,
  ): Promise<EnsureConversationScopeResult>;

  find(scopeId: string): Promise<ConversationScope | null>;

  attachResource(input: {
    conversationId: string;
    scopeId: string;
    resource: ConversationScopeResourceRef;
  }): Promise<ConversationScopeResourceRef>;

  resolve(input: {
    scopeId: string;
    resolvedAt: string;
  }): Promise<ConversationScope | null>;

  archive(input: {
    scopeId: string;
    archivedAt: string;
  }): Promise<ConversationScope | null>;
}
