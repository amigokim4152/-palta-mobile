import type {
  SqlDatabase,
  SqlExecutor,
  SqlQueryResult,
} from './sqlDatabase.js';

const BUSINESS_CONTEXT_KEY = 'app.current_business_id';

function assertBusinessId(businessId: string): void {
  if (!businessId.trim()) throw new Error('businessId is required for scoped database access.');
}

async function setBusinessContext(
  tx: SqlExecutor,
  businessId: string,
): Promise<void> {
  await tx.query(
    `select set_config($1, $2, true)`,
    [BUSINESS_CONTEXT_KEY, businessId],
  );
}

/**
 * Adds a transaction-local business context consumed by Postgres RLS policies.
 *
 * Important:
 * - `is_local=true` prevents the tenant context from leaking across pooled
 *   connections after COMMIT/ROLLBACK.
 * - Even a single read is executed inside a transaction so the context and the
 *   query are guaranteed to use the same connection.
 * - This wrapper is intended for business-scoped API requests. Trusted system
 *   workers that legitimately reconcile across businesses use a separate DB
 *   principal and must never be exposed to clients.
 */
export class BusinessScopedSqlDatabase implements SqlDatabase {
  constructor(
    private readonly delegate: SqlDatabase,
    readonly businessId: string,
  ) {
    assertBusinessId(businessId);
  }

  async query<TRow extends Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<TRow>> {
    return this.delegate.transaction(async (tx) => {
      await setBusinessContext(tx, this.businessId);
      return tx.query<TRow>(sql, params);
    });
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return this.delegate.transaction(async (tx) => {
      await setBusinessContext(tx, this.businessId);
      return work(tx);
    });
  }
}
