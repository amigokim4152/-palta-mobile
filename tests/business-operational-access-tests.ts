import {
  ACCOUNTANT_IS_NOT_PAYMENT_OPERATOR,
  canPerformBusinessOperation,
  capabilitiesForBusinessRole,
  type BusinessOperationalGrant,
} from '../src/access/businessOperationalAccess.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = '2026-09-17T15:00:00.000Z';
const baseGrant: BusinessOperationalGrant = {
  businessId: '22222222-2222-4222-8222-222222222222',
  userId: '11111111-1111-4111-8111-111111111111',
  role: 'accountant',
  status: 'active',
  grantedByUserId: '99999999-9999-4999-8999-999999999999',
  grantedAt: '2026-09-17T14:00:00.000Z',
};

assert(
  canPerformBusinessOperation({
    grant: baseGrant,
    businessId: baseGrant.businessId,
    capability: 'fiscal.export',
    now,
  }),
  'Accountant should be able to export fiscal records for an authorized client business.',
);
assert(
  canPerformBusinessOperation({
    grant: baseGrant,
    businessId: baseGrant.businessId,
    capability: 'reports.read',
    now,
  }),
  'Accountant should be able to read authorized business reports.',
);
assert(
  !canPerformBusinessOperation({
    grant: baseGrant,
    businessId: baseGrant.businessId,
    capability: 'payment.initiate',
    now,
  }) &&
    !canPerformBusinessOperation({
      grant: baseGrant,
      businessId: baseGrant.businessId,
      capability: 'payment.refund',
      now,
    }) &&
    !canPerformBusinessOperation({
      grant: baseGrant,
      businessId: baseGrant.businessId,
      capability: 'pos.cash.adjust',
      now,
    }),
  'Accountant access must not silently become money-moving or Caja authority.',
);
assert(
  !canPerformBusinessOperation({
    grant: baseGrant,
    businessId: '33333333-3333-4333-8333-333333333333',
    capability: 'fiscal.read',
    now,
  }),
  'A grant for one business must never authorize another business.',
);
assert(
  !canPerformBusinessOperation({
    grant: { ...baseGrant, status: 'revoked' },
    businessId: baseGrant.businessId,
    capability: 'fiscal.read',
    now,
  }),
  'Revoked professional access must stop immediately.',
);
assert(
  !canPerformBusinessOperation({
    grant: {
      ...baseGrant,
      expiresAt: '2026-09-17T14:59:59.000Z',
    },
    businessId: baseGrant.businessId,
    capability: 'fiscal.read',
    now,
  }),
  'Expired accountant access must not remain usable.',
);

const cashierCaps = capabilitiesForBusinessRole('cashier');
assert(
  cashierCaps.includes('payment.initiate') &&
    cashierCaps.includes('fiscal.request') &&
    !cashierCaps.includes('payment.refund') &&
    !cashierCaps.includes('fiscal.settings.manage'),
  'Cashier may complete ordinary checkout/fiscal requests without provider/fiscal administration powers.',
);
assert(ACCOUNTANT_IS_NOT_PAYMENT_OPERATOR === true, 'Accountant/payment separation is a frozen invariant.');

console.log('PASS: business operational role and accountant isolation tests');
