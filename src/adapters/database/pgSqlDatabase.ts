import type {
  SqlDatabase,
  SqlExecutor,
  SqlQueryResult,
} from '../../persistence/sqlDatabase.js';

export interface PgClientLike {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<TRow extends Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<{ rows: TRow[]; rowCount: number | null }>;
}

export type PgClientFactory = () => PgClientLike;

function normalizeResult<TRow extends Record<string, unknown>>(
  result: { rows: TRow[]; rowCount: number | null },
): SqlQueryResult<TRow> {
  return {
    rows: result.rows,
    rowCount: result.rowCount ?? result.rows.length,
  };
}

/**
 * Minimal adapter for node-postgres compatible clients.
 *
 * In Cloudflare Workers the factory should create one `pg.Client` using the
 * Hyperdrive binding's connectionString. Hyperdrive owns connection pooling;
 * this adapter owns SQL transaction semantics only.
 */
export class PgSqlDatabase implements SqlDatabase {
  constructor(private readonly createClient: PgClientFactory) {}

  async query<TRow extends Record<string, unknown>>(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<SqlQueryResult<TRow>> {
    const client = this.createClient();
    await client.connect();
    try {
      return normalizeResult(await client.query<TRow>(sql, params));
    } finally {
      await client.end();
    }
  }

  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    const client = this.createClient();
    await client.connect();
    try {
      await client.query('begin');
      const tx: SqlExecutor = {
        query: async <TRow extends Record<string, unknown>>(
          sql: string,
          params: readonly unknown[] = [],
        ): Promise<SqlQueryResult<TRow>> =>
          normalizeResult(await client.query<TRow>(sql, params)),
      };
      const result = await work(tx);
      await client.query('commit');
      return result;
    } catch (error) {
      try {
        await client.query('rollback');
      } catch {
        // Preserve the original failure. Rollback failure is an operational
        // incident for observability, but must not replace the root cause here.
      }
      throw error;
    } finally {
      await client.end();
    }
  }
}
