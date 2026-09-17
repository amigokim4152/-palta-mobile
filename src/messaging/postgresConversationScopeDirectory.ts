import type { DatabasePort } from '../ports/databasePort.js';
import type {
  ConversationScope,
  ConversationScopeResourceRef,
  ScopeAccessMode,
  ScopeResourceRelation,
} from './contracts.js';
import type {
  ConversationScopeDirectoryPort,
  EnsureConversationScopeInput,
  EnsureConversationScopeResult,
} from './scopeDirectoryPort.js';

function mapScope(row: Record<string, unknown>): ConversationScope {
  const label = typeof row.label === 'string' ? row.label : undefined;
  const resolvedAt = row.resolved_at ? String(row.resolved_at) : undefined;
  const archivedAt = row.archived_at ? String(row.archived_at) : undefined;

  return {
    scopeId: String(row.id),
    conversationId: String(row.conversation_id),
    scopeType: String(row.scope_type),
    ...(label !== undefined ? { label } : {}),
    state: String(row.scope_state) as ConversationScope['state'],
    createdAt: String(row.created_at),
    ...(resolvedAt !== undefined ? { resolvedAt } : {}),
    ...(archivedAt !== undefined ? { archivedAt } : {}),
  };
}

function mapResource(row: Record<string, unknown>): ConversationScopeResourceRef {
  const snapshotVersion = typeof row.snapshot_version === 'string'
    ? row.snapshot_version
    : undefined;
  const sourceCore = typeof row.source_core === 'string'
    ? row.source_core
    : undefined;
  const authorizationEvidenceRef = typeof row.authorization_evidence_ref === 'string'
    ? row.authorization_evidence_ref
    : undefined;
  const accessMode = typeof row.access_mode === 'string'
    ? row.access_mode as ScopeAccessMode
    : undefined;

  return {
    scopeId: String(row.scope_id),
    relation: String(row.relation) as ScopeResourceRelation,
    resourceType: String(row.resource_type),
    resourceId: String(row.resource_id),
    ...(snapshotVersion !== undefined ? { snapshotVersion } : {}),
    ...(sourceCore !== undefined ? { sourceCore } : {}),
    ...(authorizationEvidenceRef !== undefined
      ? { authorizationEvidenceRef }
      : {}),
    ...(accessMode !== undefined ? { accessMode } : {}),
  };
}

async function selectScope(
  db: DatabasePort,
  scopeId: string,
): Promise<ConversationScope | null> {
  const result = await db.query(
    `select id, conversation_id, scope_type, label, scope_state,
            created_at, resolved_at, archived_at
       from msg_conversation_scope
      where id = $1`,
    [scopeId],
  );
  const row = result.rows[0];
  return row ? mapScope(row) : null;
}

async function selectPrimaryResource(
  db: DatabasePort,
  input: {
    scopeId: string;
    resourceType: string;
    resourceId: string;
  },
): Promise<ConversationScopeResourceRef | null> {
  const result = await db.query(
    `select scope_id, relation, resource_type, resource_id, snapshot_version,
            source_core, authorization_evidence_ref, access_mode
       from msg_scope_resource
      where scope_id = $1
        and relation = 'primary'
        and resource_type = $2
        and resource_id = $3`,
    [input.scopeId, input.resourceType, input.resourceId],
  );
  const row = result.rows[0];
  return row ? mapResource(row) : null;
}

export class PostgresConversationScopeDirectory
  implements ConversationScopeDirectoryPort {
  constructor(private readonly db: DatabasePort) {}

  async ensureForPrimaryResource(
    input: EnsureConversationScopeInput,
  ): Promise<EnsureConversationScopeResult> {
    return this.db.transaction(async (tx) => {
      await tx.query(
        `insert into msg_scope_identity (
           conversation_id, source_core, resource_type, resource_id, created_at
         ) values ($1, $2, $3, $4, $5)
         on conflict (conversation_id, source_core, resource_type, resource_id)
         do nothing`,
        [
          input.conversationId,
          input.sourceCore,
          input.primaryResource.resourceType,
          input.primaryResource.resourceId,
          input.createdAt,
        ],
      );

      const identityResult = await tx.query(
        `select scope_id
           from msg_scope_identity
          where conversation_id = $1
            and source_core = $2
            and resource_type = $3
            and resource_id = $4
          for update`,
        [
          input.conversationId,
          input.sourceCore,
          input.primaryResource.resourceType,
          input.primaryResource.resourceId,
        ],
      );
      const identity = identityResult.rows[0];
      if (!identity) throw new Error('Scope identity row was not created.');

      if (identity.scope_id) {
        const scopeId = String(identity.scope_id);
        const scope = await selectScope(tx, scopeId);
        const primaryResource = await selectPrimaryResource(tx, {
          scopeId,
          resourceType: input.primaryResource.resourceType,
          resourceId: input.primaryResource.resourceId,
        });
        if (!scope || !primaryResource) {
          throw new Error('Scope identity references incomplete canonical scope state.');
        }
        return { scope, primaryResource, created: false };
      }

      await tx.query(
        `insert into msg_conversation_scope (
           id, conversation_id, scope_type, label, scope_state, created_at
         ) values ($1, $2, $3, $4, 'active', $5)`,
        [
          input.scopeId,
          input.conversationId,
          input.scopeType,
          input.label ?? null,
          input.createdAt,
        ],
      );

      await tx.query(
        `insert into msg_scope_resource (
           scope_id, relation, resource_type, resource_id,
           source_core, authorization_evidence_ref, access_mode, attached_at
         ) values ($1, 'primary', $2, $3, $4, $5, $6, $7)`,
        [
          input.scopeId,
          input.primaryResource.resourceType,
          input.primaryResource.resourceId,
          input.sourceCore,
          input.authorizationEvidenceRef,
          input.accessMode,
          input.createdAt,
        ],
      );

      await tx.query(
        `update msg_scope_identity
            set scope_id = $5
          where conversation_id = $1
            and source_core = $2
            and resource_type = $3
            and resource_id = $4`,
        [
          input.conversationId,
          input.sourceCore,
          input.primaryResource.resourceType,
          input.primaryResource.resourceId,
          input.scopeId,
        ],
      );

      return {
        scope: {
          scopeId: input.scopeId,
          conversationId: input.conversationId,
          scopeType: input.scopeType,
          ...(input.label !== undefined ? { label: input.label } : {}),
          state: 'active',
          createdAt: input.createdAt,
        },
        primaryResource: {
          scopeId: input.scopeId,
          relation: 'primary',
          resourceType: input.primaryResource.resourceType,
          resourceId: input.primaryResource.resourceId,
          sourceCore: input.sourceCore,
          authorizationEvidenceRef: input.authorizationEvidenceRef,
          accessMode: input.accessMode,
        },
        created: true,
      };
    });
  }

  async find(scopeId: string): Promise<ConversationScope | null> {
    return selectScope(this.db, scopeId);
  }

  async attachResource(input: {
    conversationId: string;
    scopeId: string;
    resource: ConversationScopeResourceRef;
  }): Promise<ConversationScopeResourceRef> {
    return this.db.transaction(async (tx) => {
      const scopeResult = await tx.query(
        `select conversation_id
           from msg_conversation_scope
          where id = $1
          for update`,
        [input.scopeId],
      );
      const scope = scopeResult.rows[0];
      if (!scope) throw new Error('SCOPE_NOT_FOUND');
      if (String(scope.conversation_id) !== input.conversationId) {
        throw new Error('SCOPE_CONVERSATION_MISMATCH');
      }

      await tx.query(
        `insert into msg_scope_resource (
           scope_id, relation, resource_type, resource_id, snapshot_version,
           source_core, authorization_evidence_ref, access_mode
         ) values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (scope_id, relation, resource_type, resource_id)
         do nothing`,
        [
          input.scopeId,
          input.resource.relation,
          input.resource.resourceType,
          input.resource.resourceId,
          input.resource.snapshotVersion ?? null,
          input.resource.sourceCore ?? null,
          input.resource.authorizationEvidenceRef ?? null,
          input.resource.accessMode ?? null,
        ],
      );

      const resourceResult = await tx.query(
        `select scope_id, relation, resource_type, resource_id, snapshot_version,
                source_core, authorization_evidence_ref, access_mode
           from msg_scope_resource
          where scope_id = $1
            and relation = $2
            and resource_type = $3
            and resource_id = $4`,
        [
          input.scopeId,
          input.resource.relation,
          input.resource.resourceType,
          input.resource.resourceId,
        ],
      );
      const row = resourceResult.rows[0];
      if (!row) throw new Error('Scope resource was not persisted.');
      return mapResource(row);
    });
  }

  async resolve(input: {
    scopeId: string;
    resolvedAt: string;
  }): Promise<ConversationScope | null> {
    const result = await this.db.query(
      `update msg_conversation_scope
          set scope_state = case
                when scope_state = 'active' then 'resolved'
                else scope_state
              end,
              resolved_at = case
                when scope_state = 'active' then coalesce(resolved_at, $2)
                else resolved_at
              end
        where id = $1
      returning id, conversation_id, scope_type, label, scope_state,
                created_at, resolved_at, archived_at`,
      [input.scopeId, input.resolvedAt],
    );
    const row = result.rows[0];
    return row ? mapScope(row) : null;
  }

  async archive(input: {
    scopeId: string;
    archivedAt: string;
  }): Promise<ConversationScope | null> {
    const result = await this.db.query(
      `update msg_conversation_scope
          set scope_state = 'archived',
              archived_at = coalesce(archived_at, $2)
        where id = $1
      returning id, conversation_id, scope_type, label, scope_state,
                created_at, resolved_at, archived_at`,
      [input.scopeId, input.archivedAt],
    );
    const row = result.rows[0];
    return row ? mapScope(row) : null;
  }
}
