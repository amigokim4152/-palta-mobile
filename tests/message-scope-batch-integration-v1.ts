import type {
  ActorRef,
  ConversationScope,
  ConversationScopeResourceRef,
} from '../src/messaging/contracts.js';
import {
  ConversationScopeService,
  ConversationScopeServiceError,
} from '../src/messaging/conversationScopeService.js';
import type { ScopeResourceAuthorizationPort } from '../src/messaging/scopeAuthorizationPort.js';
import type {
  ConversationScopeDirectoryPort,
  EnsureConversationScopeInput,
  EnsureConversationScopeResult,
} from '../src/messaging/scopeDirectoryPort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectCode(
  code: ConversationScopeServiceError['code'],
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    assert(error instanceof ConversationScopeServiceError, `Expected ${code}.`);
    assert(error.code === code, `Expected ${code}, received ${error.code}.`);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

function scopeIdentity(input: EnsureConversationScopeInput): string {
  return [
    input.conversationId,
    input.sourceCore,
    input.primaryResource.resourceType,
    input.primaryResource.resourceId,
  ].join('|');
}

function refIdentity(ref: ConversationScopeResourceRef): string {
  return [ref.scopeId, ref.relation, ref.resourceType, ref.resourceId].join('|');
}

class MemoryScopeDirectory implements ConversationScopeDirectoryPort {
  readonly scopes = new Map<string, ConversationScope>();
  readonly identities = new Map<string, string>();
  readonly resources = new Map<string, ConversationScopeResourceRef>();

  async ensureForPrimaryResource(
    input: EnsureConversationScopeInput,
  ): Promise<EnsureConversationScopeResult> {
    const identity = scopeIdentity(input);
    const existingId = this.identities.get(identity);
    if (existingId) {
      const scope = this.scopes.get(existingId)!;
      const primaryResource = this.resources.get(
        refIdentity({
          scopeId: existingId,
          relation: 'primary',
          resourceType: input.primaryResource.resourceType,
          resourceId: input.primaryResource.resourceId,
        }),
      )!;
      return { scope, primaryResource, created: false };
    }

    const scope: ConversationScope = {
      scopeId: input.scopeId,
      conversationId: input.conversationId,
      scopeType: input.scopeType,
      ...(input.label !== undefined ? { label: input.label } : {}),
      state: 'active',
      createdAt: input.createdAt,
    };
    const primaryResource: ConversationScopeResourceRef = {
      scopeId: input.scopeId,
      relation: 'primary',
      resourceType: input.primaryResource.resourceType,
      resourceId: input.primaryResource.resourceId,
      sourceCore: input.sourceCore,
      authorizationEvidenceRef: input.authorizationEvidenceRef,
      accessMode: input.accessMode,
    };
    this.scopes.set(scope.scopeId, scope);
    this.identities.set(identity, scope.scopeId);
    this.resources.set(refIdentity(primaryResource), primaryResource);
    return { scope, primaryResource, created: true };
  }

  async find(scopeId: string): Promise<ConversationScope | null> {
    return this.scopes.get(scopeId) ?? null;
  }

  async attachResource(input: {
    conversationId: string;
    scopeId: string;
    resource: ConversationScopeResourceRef;
  }): Promise<ConversationScopeResourceRef> {
    const scope = this.scopes.get(input.scopeId);
    if (!scope) throw new Error('SCOPE_NOT_FOUND');
    if (scope.conversationId !== input.conversationId) throw new Error('SCOPE_CONVERSATION_MISMATCH');
    const key = refIdentity(input.resource);
    const existing = this.resources.get(key);
    if (existing) return existing;
    this.resources.set(key, input.resource);
    return input.resource;
  }

  async resolve(input: { scopeId: string; resolvedAt: string }): Promise<ConversationScope | null> {
    const scope = this.scopes.get(input.scopeId);
    if (!scope) return null;
    if (scope.state !== 'active') return scope;
    const next: ConversationScope = { ...scope, state: 'resolved', resolvedAt: input.resolvedAt };
    this.scopes.set(input.scopeId, next);
    return next;
  }

  async archive(input: { scopeId: string; archivedAt: string }): Promise<ConversationScope | null> {
    const scope = this.scopes.get(input.scopeId);
    if (!scope) return null;
    if (scope.state === 'archived') return scope;
    const next: ConversationScope = { ...scope, state: 'archived', archivedAt: input.archivedAt };
    this.scopes.set(input.scopeId, next);
    return next;
  }
}

const directory = new MemoryScopeDirectory();
const authorization: ScopeResourceAuthorizationPort = {
  canLink: async ({ authorizationEvidenceRef }) =>
    authorizationEvidenceRef.startsWith('ok:'),
};
let ids = 0;
const service = new ConversationScopeService(directory, authorization, {
  nextScopeId: () => `scope-${++ids}`,
});
const business: ActorRef = { actorType: 'business', actorId: 'business-1', principalUserId: 'staff-1' };

const batch = await service.ensureWithAuthorizedResources({
  conversationId: 'conv-1',
  scopeType: 'order',
  label: 'Pedido #501',
  requestedBy: business,
  sourceCore: 'commerce',
  primaryResource: { resourceType: 'order', resourceId: 'order-501' },
  authorizationEvidenceRef: 'ok:order-501',
  accessMode: 'communicate',
  createdAt: '2026-09-17T22:30:00.000Z',
  relatedResources: [
    {
      relation: 'shipment',
      sourceCore: 'commerce',
      resource: { resourceType: 'shipment', resourceId: 'shipment-501' },
      authorizationEvidenceRef: 'ok:shipment-501',
      accessMode: 'view_status',
    },
    {
      relation: 'shipment',
      sourceCore: 'commerce',
      resource: { resourceType: 'shipment', resourceId: 'shipment-501' },
      authorizationEvidenceRef: 'ok:shipment-501-duplicate',
      accessMode: 'view_status',
    },
    {
      relation: 'delivery',
      sourceCore: 'commerce',
      resource: { resourceType: 'customer_delivery', resourceId: 'delivery-501' },
      authorizationEvidenceRef: 'ok:delivery-501',
      accessMode: 'view_status',
    },
  ],
});
assert(batch.created, 'First POS/Commerce integration must create Scope.');
assert(batch.linkedResources.length === 2, 'Duplicate related resources must be collapsed within one command.');
const resourceCount = Number(directory.resources.size);

const batchRetry = await service.ensureWithAuthorizedResources({
  conversationId: 'conv-1',
  scopeType: 'order',
  requestedBy: business,
  sourceCore: 'commerce',
  primaryResource: { resourceType: 'order', resourceId: 'order-501' },
  authorizationEvidenceRef: 'ok:order-501-retry',
  accessMode: 'communicate',
  createdAt: '2026-09-17T22:31:00.000Z',
  relatedResources: [
    {
      relation: 'shipment',
      sourceCore: 'commerce',
      resource: { resourceType: 'shipment', resourceId: 'shipment-501' },
      authorizationEvidenceRef: 'ok:shipment-501-retry',
      accessMode: 'view_status',
    },
    {
      relation: 'delivery',
      sourceCore: 'commerce',
      resource: { resourceType: 'customer_delivery', resourceId: 'delivery-501' },
      authorizationEvidenceRef: 'ok:delivery-501-retry',
      accessMode: 'view_status',
    },
  ],
});
assert(!batchRetry.created, 'Retry must reuse existing Scope.');
assert(batchRetry.scope.scopeId === batch.scope.scopeId, 'Retry must preserve Scope identity.');
assert(Number(directory.resources.size) === resourceCount, 'Retry must not duplicate related resource rows.');

await expectCode('INVALID_SCOPE_REQUEST', () =>
  service.ensureWithAuthorizedResources({
    conversationId: 'conv-1',
    scopeType: 'order',
    requestedBy: business,
    sourceCore: 'commerce',
    primaryResource: { resourceType: 'order', resourceId: 'order-invalid-primary-relation' },
    authorizationEvidenceRef: 'ok:order-invalid',
    accessMode: 'communicate',
    createdAt: '2026-09-17T22:32:00.000Z',
    relatedResources: [
      {
        relation: 'primary',
        sourceCore: 'commerce',
        resource: { resourceType: 'shipment', resourceId: 'shipment-invalid' },
        authorizationEvidenceRef: 'ok:shipment-invalid',
        accessMode: 'view_status',
      },
    ],
  }),
);

const partialResourceCount = Number(directory.resources.size);
await expectCode('RESOURCE_NOT_AUTHORIZED', () =>
  service.ensureWithAuthorizedResources({
    conversationId: 'conv-1',
    scopeType: 'order',
    requestedBy: business,
    sourceCore: 'commerce',
    primaryResource: { resourceType: 'order', resourceId: 'order-777' },
    authorizationEvidenceRef: 'ok:order-777',
    accessMode: 'communicate',
    createdAt: '2026-09-17T22:33:00.000Z',
    relatedResources: [
      {
        relation: 'shipment',
        sourceCore: 'commerce',
        resource: { resourceType: 'shipment', resourceId: 'shipment-777' },
        authorizationEvidenceRef: 'ok:shipment-777',
        accessMode: 'view_status',
      },
      {
        relation: 'receipt',
        sourceCore: 'commerce',
        resource: { resourceType: 'receipt', resourceId: 'receipt-777' },
        authorizationEvidenceRef: 'denied:receipt-777',
        accessMode: 'view_status',
      },
    ],
  }),
);
assert(
  Number(directory.resources.size) === partialResourceCount + 2,
  'Partial failure may leave authorized primary + earlier related link persisted for safe retry.',
);

const recovered = await service.ensureWithAuthorizedResources({
  conversationId: 'conv-1',
  scopeType: 'order',
  requestedBy: business,
  sourceCore: 'commerce',
  primaryResource: { resourceType: 'order', resourceId: 'order-777' },
  authorizationEvidenceRef: 'ok:order-777-retry',
  accessMode: 'communicate',
  createdAt: '2026-09-17T22:34:00.000Z',
  relatedResources: [
    {
      relation: 'shipment',
      sourceCore: 'commerce',
      resource: { resourceType: 'shipment', resourceId: 'shipment-777' },
      authorizationEvidenceRef: 'ok:shipment-777-retry',
      accessMode: 'view_status',
    },
    {
      relation: 'receipt',
      sourceCore: 'commerce',
      resource: { resourceType: 'receipt', resourceId: 'receipt-777' },
      authorizationEvidenceRef: 'ok:receipt-777',
      accessMode: 'view_status',
    },
  ],
});
assert(!recovered.created, 'Recovery retry must reuse partially created Scope.');
assert(recovered.linkedResources.length === 2, 'Recovery retry must return both existing and newly attached related resources.');

console.log('Message Scope batch integration tests passed.');
