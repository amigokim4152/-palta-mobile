export type SqlQueryResult<TRow extends Record<string, unknown>> = {
  rows: readonly TRow[];
  rowCount: number;
};

export interface SqlExecutor {
  query<TRow extends Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<SqlQueryResult<TRow>>;
}

/**
 * Minimal provider-neutral SQL transaction boundary.
 * Supabase/Postgres, Neon/Postgres or another Postgres driver may implement it
 * outside the domain core. The callback MUST commit as one transaction or roll
 * back all statements when it throws.
 */
export interface SqlDatabase extends SqlExecutor {
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}
