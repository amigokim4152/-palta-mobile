export type BusinessOperationalRole =
  | 'owner'
  | 'manager'
  | 'cashier'
  | 'accountant'
  | 'viewer';

export type BusinessOperationalCapability =
  | 'commerce.read'
  | 'commerce.sell'
  | 'payment.initiate'
  | 'payment.refund'
  | 'pos.session.open_close'
  | 'pos.cash.adjust'
  | 'fiscal.request'
  | 'fiscal.read'
  | 'fiscal.export'
  | 'fiscal.settings.manage'
  | 'payment.settings.manage'
  | 'printing.reprint'
  | 'reports.read'
  | 'staff.manage';

const ROLE_CAPABILITIES: Record<
  BusinessOperationalRole,
  ReadonlySet<BusinessOperationalCapability>
> = {
  owner: new Set<BusinessOperationalCapability>([
    'commerce.read',
    'commerce.sell',
    'payment.initiate',
    'payment.refund',
    'pos.session.open_close',
    'pos.cash.adjust',
    'fiscal.request',
    'fiscal.read',
    'fiscal.export',
    'fiscal.settings.manage',
    'payment.settings.manage',
    'printing.reprint',
    'reports.read',
    'staff.manage',
  ]),
  manager: new Set<BusinessOperationalCapability>([
    'commerce.read',
    'commerce.sell',
    'payment.initiate',
    'payment.refund',
    'pos.session.open_close',
    'pos.cash.adjust',
    'fiscal.request',
    'fiscal.read',
    'fiscal.export',
    'printing.reprint',
    'reports.read',
  ]),
  cashier: new Set<BusinessOperationalCapability>([
    'commerce.read',
    'commerce.sell',
    'payment.initiate',
    'pos.session.open_close',
    'fiscal.request',
    'fiscal.read',
    'printing.reprint',
  ]),
  accountant: new Set<BusinessOperationalCapability>([
    'commerce.read',
    'fiscal.read',
    'fiscal.export',
    'reports.read',
  ]),
  viewer: new Set<BusinessOperationalCapability>([
    'commerce.read',
    'reports.read',
  ]),
};

export type BusinessOperationalGrant = {
  businessId: string;
  userId: string;
  role: BusinessOperationalRole;
  status: 'active' | 'suspended' | 'revoked';
  grantedByUserId: string;
  grantedAt: string;
  expiresAt?: string;
};

export function canPerformBusinessOperation(input: {
  grant: BusinessOperationalGrant;
  businessId: string;
  capability: BusinessOperationalCapability;
  now: string;
}): boolean {
  const { grant } = input;
  if (grant.businessId !== input.businessId) return false;
  if (grant.status !== 'active') return false;
  if (grant.expiresAt !== undefined && Date.parse(grant.expiresAt) <= Date.parse(input.now)) {
    return false;
  }
  return ROLE_CAPABILITIES[grant.role].has(input.capability);
}

export function capabilitiesForBusinessRole(
  role: BusinessOperationalRole,
): readonly BusinessOperationalCapability[] {
  return [...ROLE_CAPABILITIES[role]].sort();
}

/**
 * Fiscal/accounting access is deliberately separate from money-moving access.
 * An accountant can inspect/export fiscal and reporting data without gaining
 * permission to initiate payments, issue refunds, adjust cash or manage provider
 * credentials unless the owner explicitly gives a different operational role.
 */
export const ACCOUNTANT_IS_NOT_PAYMENT_OPERATOR = true as const;
