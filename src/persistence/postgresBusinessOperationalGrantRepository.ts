import type {
  BusinessOperationalGrant,
  BusinessOperationalRole,
} from '../access/businessOperationalAccess.js';
import type {
  BusinessOperationalGrantLookup,
  BusinessOperationalGrantRepository,
} from './businessOperationalGrantRepository.js';
import type { SqlDatabase } from './sqlDatabase.js';

type GrantStatus = BusinessOperationalGrant['status'];
type TimestampValue = string | Date;

type GrantRow = {
  business_id: string;
  user_id: string;
  role: string;
  status: string;
  granted_by_user_id: string;
  granted_at: TimestampValue;
  expires_at: TimestampValue | null;
};

const ROLES = new Set<BusinessOperationalRole>([
  'owner',
  'manager',
  'cashier',
  'accountant',
  'viewer',
]);

const STATUSES = new Set<GrantStatus>(['active', 'suspended', 'revoked']);

function role(value: string): BusinessOperationalRole {
  if (!ROLES.has(value as BusinessOperationalRole)) {
    throw new Error(`Unsupported business operational role: ${value}`);
  }
  return value as BusinessOperationalRole;
}

function status(value: string): GrantStatus {
  if (!STATUSES.has(value as GrantStatus)) {
    throw new Error(`Unsupported business operational grant status: ${value}`);
  }
  return value as GrantStatus;
}

function isoTimestamp(value: TimestampValue, field: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid business operational grant ${field} timestamp.`);
  }
  return date.toISOString();
}

function rowToGrant(row: GrantRow): BusinessOperationalGrant {
  const grant: BusinessOperationalGrant = {
    businessId: row.business_id,
    userId: row.user_id,
    role: role(row.role),
    status: status(row.status),
    grantedByUserId: row.granted_by_user_id,
    grantedAt: isoTimestamp(row.granted_at, 'granted_at'),
  };
  if (row.expires_at !== null) {
    grant.expiresAt = isoTimestamp(row.expires_at, 'expires_at');
  }
  return grant;
}

/**
 * PostgreSQL implementation for the canonical business grant table.
 *
 * The supplied database should normally be BusinessScopedSqlDatabase so the
 * transaction-local business ID is applied before this query and PostgreSQL RLS
 * remains an independent tenant-isolation layer.
 */
export class PostgresBusinessOperationalGrantRepository
  implements BusinessOperationalGrantRepository
{
  constructor(private readonly db: SqlDatabase) {}

  async findGrant(
    lookup: BusinessOperationalGrantLookup,
  ): Promise<BusinessOperationalGrant | null> {
    if (!lookup.businessId.trim()) throw new Error('businessId is required.');
    if (!lookup.userId.trim()) throw new Error('userId is required.');

    const result = await this.db.query<GrantRow>(
      `select
         business_id,
         user_id,
         role,
         status,
         granted_by_user_id,
         granted_at,
         expires_at
       from business_operational_grant
       where business_id = $1 and user_id = $2
       limit 1`,
      [lookup.businessId, lookup.userId],
    );

    const row = result.rows[0];
    return row ? rowToGrant(row) : null;
  }
}
