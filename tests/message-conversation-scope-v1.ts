import type { DatabasePort, QueryResult } from '../src/ports/databasePort.js';
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
import { PostgresConversationScopeDirectory } from '../src/messaging/postgresConversationScopeDirectory.js';

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
    assert(error instanceof ConversationScopeServiceError, `Expected ConversationScopeServiceError(${code}).`);
    assert(error.code === code, `Expected ${code}, received ${error.code}.`);
    return;
  }
  throw new Error(`Expected ConversationScopeServiceError(${code}).`);
}

function identityKey(input: EnsureConversationScopeInput): string {
  return [
    input.conversationId,
    input.sourceCore,
    input.primaryResource.resourceType,
    input.primaryResource.resourceId,
  ].join('|');
}

function resourceKey(resource: ConversationScopeResourceRef): string {
  return [
    resource.scopeId,
    resource.relation,
    resource.resourceType,
    resource.resourceId,
  ].join('|');
}

class FakeScopeDirectory implements ConversationScopeDirectoryPort {
  readonly scopes = new Map<string, ConversationScope>();
  readonly identity = new Map<string, string>();
  readonly resources = new Map<string, ConversationScopeResourceRef>();

  async ensureForPrimaryResource(
    input: EnsureConversationScopeInput,
  ): Promise<EnsureConversationScopeResult> {
    const key = identityKey(input);
    const existingScopeId = this.identity.get(key);
    if (existingScopeId) {
      const scope = this.scopes.get(existingScopeId);
      const primaryResource = this.resources.get(
        resourceKey({
          scopeId: existingScopeId,
          relation: 'primary',
          resourceType: input.primaryResource.resourceType,
          resourceId: input.primaryResource.resourceId,
        }),
      );
      if (!scope || !primaryResource) throw new Error('Incomplete fake scope state.');
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
    this.identity.set(key, scope.scopeId);
    this.resources.set(resourceKey(primaryResource), primaryResource);
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
    if (scope.conversationId !== input.conversationId) {
      throw new Error('SCOPE_CONVERSATION_MISMATCH');
    }
    const key = resourceKey(input.resource);
    const existing = this.resources.get(key);
    if (existing) return existing;
    this.resources.set(key, input.resource);
    return input.resource;
  }

  async resolve(input: {
    scopeId: string;
    resolvedAt: string;
  }): Promise<ConversationScope | null> {
    const scope = this.scopes.get(input.scopeId);
    if (!scope) return null;
    if (scope.state !== 'active') return scope;
    const next: ConversationScope = {
      ...scope,
      state: 'resolved',
      resolvedAt: input.resolvedAt,
    };
    this.scopes.set(input.scopeId, next);
    return next;
  }

  async archive(input: {
    scopeId: string;
    archivedAt: string;
  }): Promise<ConversationScope | null> {
    const scope = this.scopes.get(input.scopeId);
    if (!scope) return null;
    if (scope.state === 'archived') return scope;
    const next: ConversationScope = {
      ...scope,
      state: 'archived',
      archivedAt: input.archivedAt,
    };
    this.scopes.set(input.scopeId, next);
    return next;
  }
}

const directory = new FakeScopeDirectory();
let authorizationCalls = 0;
const authorization: ScopeResourceAuthorizationPort = {
  canLink: async ({ authorizationEvidenceRef }) => {
    authorizationCalls += 1;
    return authorizationEvidenceRef.startsWith('evidence-ok-');
  },
};
let scopeIds = 0;
const service = new ConversationScopeService(directory, authorization, {
  nextScopeId: () => `00000000-0000-4000-9000-${String(++scopeIds).padStart(12, '0')}`,
});
const user: ActorRef = { actorType: 'user', actorId: 'user-1' };

await expectCode('RESOURCE_NOT_AUTHORIZED', () =>
  service.ensureForPrimaryResource({
    conversationId: 'conv-1',
    scopeType: 'order',
    requestedBy: user,
    sourceCore: 'commerce',
    primaryResource: { resourceType: 'order', resourceId: 'order-denied' },
    authorizationEvidenceRef: 'evidence-denied',
    accessMode: 'communicate',
    createdAt: '2026-09-17T20:40:00.000Z',
  }),
);
assert(Number(directory.scopes.size) === 0, 'Unauthorized domain resource must not create Scope state.');

const first = await service.ensureForPrimaryResource({
  conversationId: 'conv-1',
  scopeType: 'order',
  label: 'Pedido #1001',
  requestedBy: user,
  sourceCore: 'commerce',
  primaryResource: { resourceType: 'order', resourceId: 'order-1001' },
  authorizationEvidenceRef: 'evidence-ok-order-1001',
  accessMode: 'communicate',
  createdAt: '2026-09-17T20:41:00.000Z',
});
assert(first.created, 'First authorized primary resource must create one Scope.');
assert(first.primaryResource.relation === 'primary', 'Created Scope must retain canonical primary resource.');

const replay = await service.ensureForPrimaryResource({
  conversationId: 'conv-1',
  scopeType: 'order',
  label: 'Pedido #1001 retry',
  requestedBy: user,
  sourceCore: 'commerce',
  primaryResource: { resourceType: 'order', resourceId: 'order-1001' },
  authorizationEvidenceRef: 'evidence-ok-order-1001-retry',
  accessMode: 'communicate',
  createdAt: '2026-09-17T20:42:00.000Z',
});
assert(!replay.created, 'Commerce retry for the same primary resource must reuse the Scope.');
assert(replay.scope.scopeId === first.scope.scopeId, 'Scope identity must remain stable across retries.');
assert(Number(directory.scopes.size) === 1, 'Retry must not create duplicate Scope rows.');

const shipment = await service.attachAuthorizedResource({
  conversationId: 'conv-1',
  scopeId: first.scope.scopeId,
  requestedBy: user,
  sourceCore: 'commerce',
  relation: 'shipment',
  resource: { resourceType: 'shipment', resourceId: 'shipment-1001' },
  authorizationEvidenceRef: 'evidence-ok-shipment-1001',
  accessMode: 'view_status',
  snapshotVersion: 'shipment-v1',
});
assert(shipment.resourceId === 'shipment-1001', 'Authorized shipment must attach to existing order Scope.');
const resourceCountAfterAttach = Number(directory.resources.size);
await service.attachAuthorizedResource({
  conversationId: 'conv-1',
  scopeId: first.scope.scopeId,
  requestedBy: user,
  sourceCore: 'commerce',
  relation: 'shipment',
  resource: { resourceType: 'shipment', resourceId: 'shipment-1001' },
  authorizationEvidenceRef: 'evidence-ok-shipment-1001-retry',
  accessMode: 'view_status',
});
assert(Number(directory.resources.size) === resourceCountAfterAttach, 'Resource attachment retry must be idempotent.');

const authBeforeMismatch = authorizationCalls;
await expectCode('SCOPE_CONVERSATION_MISMATCH', () =>
  service.attachAuthorizedResource({
    conversationId: 'conv-other',
    scopeId: first.scope.scopeId,
    requestedBy: user,
    sourceCore: 'commerce',
    relation: 'delivery',
    resource: { resourceType: 'delivery', resourceId: 'delivery-foreign' },
    authorizationEvidenceRef: 'evidence-ok-delivery-foreign',
    accessMode: 'view_status',
  }),
);
assert(
  authorizationCalls === authBeforeMismatch,
  'Conversation mismatch must be rejected before asking the owning domain to authorize a foreign link.',
);

await expectCode('SCOPE_NOT_FOUND', () =>
  service.attachAuthorizedResource({
    conversationId: 'conv-1',
    scopeId: 'missing-scope',
    requestedBy: user,
    sourceCore: 'commerce',
    relation: 'delivery',
    resource: { resourceType: 'delivery', resourceId: 'delivery-missing-scope' },
    authorizationEvidenceRef: 'evidence-ok-delivery-missing',
    accessMode: 'view_status',
  }),
);

const resolved = await service.resolve({
  scopeId: first.scope.scopeId,
  resolvedAt: '2026-09-17T21:00:00.000Z',
});
assert(resolved.state === 'resolved', 'Active Scope must resolve.');
const resolvedAgain = await service.resolve({
  scopeId: first.scope.scopeId,
  resolvedAt: '2026-09-17T21:05:00.000Z',
});
assert(resolvedAgain.resolvedAt === '2026-09-17T21:00:00.000Z', 'Resolve retry must preserve first resolved timestamp.');
const archived = await service.archive({
  scopeId: first.scope.scopeId,
  archivedAt: '2026-09-17T21:10:00.000Z',
});
assert(archived.state === 'archived', 'Resolved Scope must archive monotonically.');
const afterResolveArchived = await service.resolve({
  scopeId: first.scope.scopeId,
  resolvedAt: '2026-09-17T21:15:00.000Z',
});
assert(afterResolveArchived.state === 'archived', 'Resolve must never reopen an archived Scope.');

// PostgreSQL adapter script: verify the durable first-create and retry paths use
// identity locking before canonical Scope creation.
type ScriptStep = {
  includes: string;
  rows: Array<Record<string, unknown>>;
};

class ScriptedDatabase implements DatabasePort {
  readonly seenSql: string[] = [];

  constructor(private readonly steps: ScriptStep[]) {}

  async query<Row = Record<string, unknown>>(
    sql: string,
    _params?: readonly unknown[],
  ): Promise<QueryResult<Row>> {
    const step = this.steps.shift();
    if (!step) throw new Error(`Unexpected SQL: ${sql}`);
    const normalized = sql.replace(/\s+/g, ' ').trim();
    this.seenSql.push(normalized);
    assert(normalized.includes(step.includes), `Expected SQL containing ${step.includes}, received ${normalized}`);
    return { rows: step.rows as Row[] };
  }

  async transaction<T>(run: (tx: DatabasePort) => Promise<T>): Promise<T> {
    return run(this);
  }

  assertConsumed(): void {
    assert(Number(this.steps.length) === 0, 'All scripted SQL steps must be consumed.');
  }
}

const createDb = new ScriptedDatabase([
  { includes: 'insert into msg_scope_identity', rows: [] },
  { includes: 'from msg_scope_identity', rows: [{ scope_id: null }] },
  { includes: 'insert into msg_conversation_scope', rows: [] },
  { includes: 'insert into msg_scope_resource', rows: [] },
  { includes: 'update msg_scope_identity', rows: [] },
]);
const postgresCreate = new PostgresConversationScopeDirectory(createDb);
const created = await postgresCreate.ensureForPrimaryResource({
  scopeId: '00000000-0000-4000-9000-000000000101',
  conversationId: '00000000-0000-4000-8000-000000000101',
  scopeType: 'service_case',
  label: 'Brake service',
  sourceCore: 'service',
  primaryResource: { resourceType: 'service_request', resourceId: 'service-101' },
  authorizationEvidenceRef: 'evidence-service-101',
  accessMode: 'communicate',
  createdAt: '2026-09-17T22:00:00.000Z',
});
assert(created.created && created.scope.state === 'active', 'PostgreSQL first-create path must return active canonical Scope.');
createDb.assertConsumed();
assert(
  createDb.seenSql.some((sql) => sql.includes('for update')),
  'PostgreSQL Scope identity path must lock identity row before creation.',
);

const replayDb = new ScriptedDatabase([
  { includes: 'insert into msg_scope_identity', rows: [] },
  { includes: 'from msg_scope_identity', rows: [{ scope_id: '00000000-0000-4000-9000-000000000101' }] },
  {
    includes: 'from msg_conversation_scope',
    rows: [{
      id: '00000000-0000-4000-9000-000000000101',
      conversation_id: '00000000-0000-4000-8000-000000000101',
      scope_type: 'service_case',
      label: 'Brake service',
      scope_state: 'active',
      created_at: '2026-09-17T22:00:00.000Z',
      resolved_at: null,
      archived_at: null,
    }],
  },
  {
    includes: "relation = 'primary'",
    rows: [{
      scope_id: '00000000-0000-4000-9000-000000000101',
      relation: 'primary',
      resource_type: 'service_request',
      resource_id: 'service-101',
      snapshot_version: null,
      source_core: 'service',
      authorization_evidence_ref: 'evidence-service-101',
      access_mode: 'communicate',
    }],
  },
]);
const postgresReplay = new PostgresConversationScopeDirectory(replayDb);
const replayed = await postgresReplay.ensureForPrimaryResource({
  scopeId: 'unused-new-scope-id',
  conversationId: '00000000-0000-4000-8000-000000000101',
  scopeType: 'service_case',
  sourceCore: 'service',
  primaryResource: { resourceType: 'service_request', resourceId: 'service-101' },
  authorizationEvidenceRef: 'evidence-service-101-retry',
  accessMode: 'communicate',
  createdAt: '2026-09-17T22:01:00.000Z',
});
assert(!replayed.created, 'PostgreSQL retry path must reuse existing canonical Scope.');
assert(replayed.scope.scopeId === created.scope.scopeId, 'PostgreSQL retry must return same Scope ID.');
replayDb.assertConsumed();

console.log('Message Conversation Scope tests passed.');
