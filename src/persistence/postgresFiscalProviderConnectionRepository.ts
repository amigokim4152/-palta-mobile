import {
  assertFiscalProviderConnection,
  type FiscalProviderConnection,
  type FiscalProviderConnectionStatus,
  type FiscalProviderEnvironment,
} from '../fiscal/chile/fiscalProviderConnection.js';
import { CHILE_DTE_CODE, type ChileDteType } from '../fiscal/chile/fiscalModel.js';
import type {
  FiscalProviderConnectionLookup,
  FiscalProviderConnectionRepository,
} from './fiscalProviderConnectionRepository.js';
import type { SqlDatabase } from './sqlDatabase.js';

type ConnectionRow = {
  id: string;
  business_id: string;
  issuer_rut: string;
  provider_key: string;
  environment: FiscalProviderEnvironment;
  status: FiscalProviderConnectionStatus;
  credential_ref: string | null;
  enabled_document_types: unknown;
  safe_configuration: unknown;
  revision: number | string;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
};

const COLUMNS = `
  id,
  business_id,
  issuer_rut,
  provider_key,
  environment,
  status,
  credential_ref,
  enabled_document_types,
  safe_configuration,
  revision,
  last_verified_at,
  created_at,
  updated_at
`;

function safeInteger(value: number | string, label: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label} must be a non-negative safe integer.`);
  return parsed;
}

function enabledDocumentTypes(value: unknown): ChileDteType[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Fiscal provider enabled_document_types must be a non-empty JSON array.');
  }
  const result: ChileDteType[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !(item in CHILE_DTE_CODE)) {
      throw new Error(`Unsupported fiscal provider DTE type: ${String(item)}`);
    }
    result.push(item as ChileDteType);
  }
  return result;
}

function safeConfiguration(value: unknown): Record<string, string | number | boolean | null> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Fiscal provider safe_configuration must be a JSON object.');
  }
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (
      item !== null &&
      typeof item !== 'string' &&
      typeof item !== 'number' &&
      typeof item !== 'boolean'
    ) {
      throw new Error(`Fiscal provider safe_configuration.${key} must be scalar/null.`);
    }
    result[key] = item;
  }
  return result;
}

function rowToConnection(row: ConnectionRow): FiscalProviderConnection {
  const connection: FiscalProviderConnection = {
    id: row.id,
    businessId: row.business_id,
    issuerRut: row.issuer_rut,
    providerKey: row.provider_key,
    environment: row.environment,
    status: row.status,
    enabledDocumentTypes: enabledDocumentTypes(row.enabled_document_types),
    safeConfiguration: safeConfiguration(row.safe_configuration),
    revision: safeInteger(row.revision, 'Fiscal provider connection revision'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.credential_ref !== null) connection.credentialRef = row.credential_ref;
  if (row.last_verified_at !== null) connection.lastVerifiedAt = row.last_verified_at;
  assertFiscalProviderConnection(connection);
  return connection;
}

export class PostgresFiscalProviderConnectionRepository
  implements FiscalProviderConnectionRepository
{
  constructor(private readonly db: SqlDatabase) {}

  async findConnection(
    lookup: FiscalProviderConnectionLookup,
  ): Promise<FiscalProviderConnection | null> {
    const result = await this.db.query<ConnectionRow>(
      `select ${COLUMNS}
       from fiscal_provider_connection
       where business_id = $1
         and issuer_rut = $2
         and provider_key = $3
         and id = $4
       limit 1`,
      [lookup.businessId, lookup.issuerRut, lookup.providerKey, lookup.connectionId],
    );
    const row = result.rows[0];
    return row ? rowToConnection(row) : null;
  }
}
