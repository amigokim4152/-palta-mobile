import type {
  ActorRef,
  ConversationScope,
  ConversationScopeResourceRef,
  ResourceRef,
  ScopeAccessMode,
  ScopeResourceRelation,
} from './contracts.js';

export interface EcosystemLinkRequest {
  requestId: string;
  conversationId: string;
  scopeId: string;
  requestedBy: ActorRef;
  resource: ResourceRef;
  relation: ScopeResourceRelation;
  sourceCore: string;
  /**
   * Opaque, non-secret evidence ID produced by the owning domain after it has
   * authorized/claimed the resource. Never put a bearer token, share URL,
   * phone number, email address or document payload here.
   */
  authorizationEvidenceRef: string;
  accessMode: ScopeAccessMode;
  requestedAt: string;
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

export function buildEcosystemLinkRequest(input: {
  requestId: string;
  scope: ConversationScope;
  requestedBy: ActorRef;
  resource: ResourceRef;
  relation: ScopeResourceRelation;
  sourceCore: string;
  authorizationEvidenceRef: string;
  accessMode: ScopeAccessMode;
  requestedAt: string;
}): EcosystemLinkRequest {
  if (input.scope.state === 'archived') throw new Error('Cannot link a resource to an archived conversation scope.');
  required(input.requestId, 'requestId');
  required(input.scope.scopeId, 'scopeId');
  required(input.scope.conversationId, 'conversationId');
  required(input.resource.resourceType, 'resourceType');
  required(input.resource.resourceId, 'resourceId');
  required(input.sourceCore, 'sourceCore');
  required(input.authorizationEvidenceRef, 'authorizationEvidenceRef');

  return {
    requestId: input.requestId,
    conversationId: input.scope.conversationId,
    scopeId: input.scope.scopeId,
    requestedBy: input.requestedBy,
    resource: { ...input.resource },
    relation: input.relation,
    sourceCore: input.sourceCore,
    authorizationEvidenceRef: input.authorizationEvidenceRef,
    accessMode: input.accessMode,
    requestedAt: input.requestedAt,
  };
}

export function scopeResourceFromAuthorizedLink(
  request: EcosystemLinkRequest,
  snapshotVersion?: string,
): ConversationScopeResourceRef {
  const base: ConversationScopeResourceRef = {
    scopeId: request.scopeId,
    relation: request.relation,
    resourceType: request.resource.resourceType,
    resourceId: request.resource.resourceId,
    sourceCore: request.sourceCore,
    authorizationEvidenceRef: request.authorizationEvidenceRef,
    accessMode: request.accessMode,
  };
  return snapshotVersion === undefined ? base : { ...base, snapshotVersion };
}
