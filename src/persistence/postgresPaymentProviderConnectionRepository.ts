import {
  assertPaymentProviderConnection,
  type PaymentProviderConnection,
  type PaymentProviderConnectionStatus,
  type PaymentProviderEnvironment,
} from '../payment/paymentProviderConnection.js';
import type {
  PaymentProviderConnectionLookup,
  PaymentProviderConnectionRepository,
} from './paymentProviderConnectionRepository.js';
import type { SqlDatabase } from './sqlDatabase.js';

type ConnectionRow = {
  id: string;
  business_id: string;
  provider_key: string;
  environment: PaymentProviderEnvironment;
  status: PaymentProviderConnectionStatus;
  credential_ref: string | null;
  merchant_ref: string | null;
  capabilities: unknown;
  safe_configuration: unknown;
  revision: number | string;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

function safeRevision(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Payment provider connection revision is outside safe-integer range.');
  }
  return parsed;
}

function booleanRecord(value: unknown): Record<string, boolean> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Payment provider capabilities must be a JSON object.');
  }
  const result: Record<string, boolean> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item !== 'boolean') {
      throw new Error(`Payment provider capability ${key} must be boolean.`);
    }
    result[key] = item;
  }
  return result;
}

function safeConfiguration(
  value: unknown,
): Record<string, string | number | boolean | null> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Payment provider safe_configuration must be a JSON object.');
  }
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (
      item !== null &&
      typeof item !== 'string' &&
      typeof item !== 'number' &&
      typeof item !== 'boolean'
    ) {
      throw new Error(`Payment provider safe_configuration ${key} has unsupported value.`);
    }
    result[key] = item as string | number | boolean | null;
  }
  return result;
}

function rowToConnection(row: ConnectionRow): PaymentProviderConnection {
  const connection: PaymentProviderConnection = {
    id: row.id,
    businessId: row.business_id,
    providerKey: row.provider_key,
    environment: row.environment,
    status: row.status,
    capabilities: booleanRecord(row.capabilities),
    safeConfiguration: safeConfiguration(row.safe_configuration),
    revision: safeRevision(row.revision),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.credential_ref !== null) connection.credentialRef = row.credential_ref;
  if (row.merchant_ref !== null) connection.merchantRef = row.merchant_ref;
  if (row.last_verified_at !== null) connection.lastVerifiedAt = row.last_verified_at;
  assertPaymentProviderConnection(connection);
  return connection;
}

export class PostgresPaymentProviderConnectionRepository
  implements PaymentProviderConnectionRepository
{
  constructor(private readonly db: SqlDatabase) {}

  async findConnection(
    lookup: PaymentProviderConnectionLookup,
  ): Promise<PaymentProviderConnection | null> {
    const result = await this.db.query<ConnectionRow>(
      `select
        id,
        business_id,
        provider_key,
        environment,
        status,
        credential_ref,
        merchant_ref,
        capabilities,
        safe_configuration,
        revision,
        last_verified_at,
        created_at,
        updated_at
       from payment_provider_connection
       where business_id = $1 and id = $2 and provider_key = $3
       limit 1`,
      [lookup.businessId, lookup.connectionId, lookup.providerKey],
    );
    const row = result.rows[0];
    return row ? rowToConnection(row) : null;
  }
}
