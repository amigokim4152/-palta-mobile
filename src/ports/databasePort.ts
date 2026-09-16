export type QueryResult<Row = Record<string, unknown>> = {
  rows: Row[];
};

export interface DatabasePort {
  query<Row = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<Row>>;

  transaction<T>(run: (tx: DatabasePort) => Promise<T>): Promise<T>;
}
