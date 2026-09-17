import type {
  ActorRef,
  ConversationScope,
  ConversationScopeResourceRef,
  ResourceRef,
  ScopeAccessMode,
  ScopeResourceRelation,
} from './contracts.js';
import type { ScopeResourceAuthorizationPort } from './scopeAuthorizationPort.js';
import type { ConversationScopeDirectoryPort } from './scopeDirectoryPort.js';

export interface ConversationScopeRuntime {
  nextScopeId(): string;
}

export class ConversationScopeServiceError extends Error {
  constructor(
    readonly code:
      | 'INVALID_SCOPE_REQUEST'
      | 'RESOURCE_NOT_AUTHORIZED'
      | 'SCOPE_NOT_FOUND'
      | 'SCOPE_CONVERSATION_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'ConversationScopeServiceError';
  }
}

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ConversationScopeServiceError(
      'INVALID_SCOPE_REQUEST',
      `${label} is required.`,
    );
  }
  return normalized;
}

export class ConversationScopeService {
  constructor(
    private readonly directory: ConversationScopeDirectoryPort,
    private readonly authorization: ScopeResourceAuthorizationPort,
    private readonly runtime: ConversationScopeRuntime,
  ) {}

  private async assertResourceAuthorized(input: {
    conversationId: string;
    requestedBy: ActorRef;
    sourceCore: string;
    resource: ResourceRef;
    authorizationEvidenceRef: string;
    accessMode: ScopeAccessMode;
  }): Promise<void> {
    required(input.conversationId, 'conversationId');
    required(input.requestedBy.actorId, 'requestedBy.actorId');
    required(input.sourceCore, 'sourceCore');
    required(input.resource.resourceType, 'resource.resourceType');
    required(input.resource.resourceId, 'resource.resourceId');
    required(input.authorizationEvidenceRef, 'authorizationEvidenceRef');

    const allowed = await this.authorization.canLink(input);
    if (!allowed) {
      throw new ConversationScopeServiceError(
        'RESOURCE_NOT_AUTHORIZED',
        'Owning domain did not authorize this resource/conversation link.',
      );
    }
  }

  async ensureForPrimaryResource(input: {
    conversationId: string;
    scopeType: string;
    label?: string;
    requestedBy: ActorRef;
    sourceCore: string;
    primaryResource: ResourceRef;
    authorizationEvidenceRef: string;
    accessMode: ScopeAccessMode;
    createdAt: string;
  }) {
    required(input.scopeType, 'scopeType');
    await this.assertResourceAuthorized({
      conversationId: input.conversationId,
      requestedBy: input.requestedBy,
      sourceCore: input.sourceCore,
      resource: input.primaryResource,
      authorizationEvidenceRef: input.authorizationEvidenceRef,
      accessMode: input.accessMode,
    });

    return this.directory.ensureForPrimaryResource({
      scopeId: this.runtime.nextScopeId(),
      conversationId: input.conversationId,
      scopeType: input.scopeType,
      ...(input.label !== undefined ? { label: input.label } : {}),
      sourceCore: input.sourceCore,
      primaryResource: input.primaryResource,
      authorizationEvidenceRef: input.authorizationEvidenceRef,
      accessMode: input.accessMode,
      createdAt: input.createdAt,
    });
  }

  async attachAuthorizedResource(input: {
    conversationId: string;
    scopeId: string;
    requestedBy: ActorRef;
    sourceCore: string;
    relation: ScopeResourceRelation;
    resource: ResourceRef;
    authorizationEvidenceRef: string;
    accessMode: ScopeAccessMode;
    snapshotVersion?: string;
  }): Promise<ConversationScopeResourceRef> {
    required(input.conversationId, 'conversationId');
    required(input.scopeId, 'scopeId');

    const scope = await this.directory.find(input.scopeId);
    if (!scope) {
      throw new ConversationScopeServiceError('SCOPE_NOT_FOUND', 'Scope does not exist.');
    }
    if (scope.conversationId !== input.conversationId) {
      throw new ConversationScopeServiceError(
        'SCOPE_CONVERSATION_MISMATCH',
        'Scope does not belong to the requested Conversation.',
      );
    }

    await this.assertResourceAuthorized({
      conversationId: input.conversationId,
      requestedBy: input.requestedBy,
      sourceCore: input.sourceCore,
      resource: input.resource,
      authorizationEvidenceRef: input.authorizationEvidenceRef,
      accessMode: input.accessMode,
    });

    return this.directory.attachResource({
      conversationId: input.conversationId,
      scopeId: input.scopeId,
      resource: {
        scopeId: input.scopeId,
        relation: input.relation,
        resourceType: input.resource.resourceType,
        resourceId: input.resource.resourceId,
        sourceCore: input.sourceCore,
        authorizationEvidenceRef: input.authorizationEvidenceRef,
        accessMode: input.accessMode,
        ...(input.snapshotVersion !== undefined
          ? { snapshotVersion: input.snapshotVersion }
          : {}),
      },
    });
  }

  async resolve(input: {
    scopeId: string;
    resolvedAt: string;
  }): Promise<ConversationScope> {
    required(input.scopeId, 'scopeId');
    const scope = await this.directory.resolve(input);
    if (!scope) {
      throw new ConversationScopeServiceError('SCOPE_NOT_FOUND', 'Scope does not exist.');
    }
    return scope;
  }

  async archive(input: {
    scopeId: string;
    archivedAt: string;
  }): Promise<ConversationScope> {
    required(input.scopeId, 'scopeId');
    const scope = await this.directory.archive(input);
    if (!scope) {
      throw new ConversationScopeServiceError('SCOPE_NOT_FOUND', 'Scope does not exist.');
    }
    return scope;
  }
}
