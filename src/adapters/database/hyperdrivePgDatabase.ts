import {
  PgSqlDatabase,
  type PgClientLike,
} from './pgSqlDatabase.js';

export type HyperdriveBindingLike = {
  connectionString: string;
};

export type PgClientConstructorLike = new (config: {
  connectionString: string;
}) => PgClientLike;

function assertConnectionString(connectionString: string): void {
  if (!connectionString.trim()) {
    throw new Error('Hyperdrive connectionString is required.');
  }
}

/**
 * Cloudflare Hyperdrive composition helper.
 *
 * Hyperdrive owns connection pooling. The existing PgSqlDatabase adapter owns
 * request-level client lifetime and transaction semantics. Keeping the
 * constructor injected means the domain/core never imports node-postgres and
 * remains portable to another PostgreSQL runtime.
 */
export function createHyperdrivePgDatabase(
  binding: HyperdriveBindingLike,
  Client: PgClientConstructorLike,
): PgSqlDatabase {
  assertConnectionString(binding.connectionString);
  return new PgSqlDatabase(
    () => new Client({ connectionString: binding.connectionString }),
  );
}
