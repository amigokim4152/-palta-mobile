import { BusinessAuthorizationService } from '../src/access/businessAuthorizationService.js';
import type { BusinessOperationalGrant } from '../src/access/businessOperationalAccess.js';
import type {
  BusinessOperationalGrantLookup,
  BusinessOperationalGrantRepository,
} from '../src/persistence/businessOperationalGrantRepository.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class FakeGrantRepository implements BusinessOperationalGrantRepository {
  constructor(private readonly grant: BusinessOperationalGrant | null) {}

  async findGrant(
    _lookup: BusinessOperationalGrantLookup,
  ): Promise<BusinessOperationalGrant | null> {
    return this.grant;
  }
}

const now = () => '2026-09-18T12:00:00.000Z';
const baseGrant: BusinessOperationalGrant = {
  businessId: 'biz-1',
  userId: 'user-1',
  role: 'cashier',
  status: 'active',
  grantedByUserId: 'owner-1',
  grantedAt: '2026-09-01T12:00:00.000Z',
};

const cashier = new BusinessAuthorizationService(
  new FakeGrantRepository(baseGrant),
  now,
);
const initiate = await cashier.authorize({
  identity: { userId: 'user-1' },
  businessId: 'biz-1',
  capability: 'payment.initiate',
});
assert(initiate.allowed, 'Cashier should be able to initiate a payment.');

const refund = await cashier.authorize({
  identity: { userId: 'user-1' },
  businessId: 'biz-1',
  capability: 'payment.refund',
});
assert(!refund.allowed, 'Cashier must not gain refund capability.');

const accountant = new BusinessAuthorizationService(
  new FakeGrantRepository({ ...baseGrant, role: 'accountant' }),
  now,
);
const accountantPayment = await accountant.authorize({
  identity: { userId: 'user-1' },
  businessId: 'biz-1',
  capability: 'payment.initiate',
});
assert(!accountantPayment.allowed, 'Accountant must not initiate payments.');

const expired = new BusinessAuthorizationService(
  new FakeGrantRepository({
    ...baseGrant,
    expiresAt: '2026-09-18T11:59:59.000Z',
  }),
  now,
);
const expiredDecision = await expired.authorize({
  identity: { userId: 'user-1' },
  businessId: 'biz-1',
  capability: 'commerce.read',
});
assert(!expiredDecision.allowed, 'Expired grant must fail closed.');

const suspended = new BusinessAuthorizationService(
  new FakeGrantRepository({ ...baseGrant, status: 'suspended' }),
  now,
);
const suspendedDecision = await suspended.authorize({
  identity: { userId: 'user-1' },
  businessId: 'biz-1',
  capability: 'commerce.read',
});
assert(!suspendedDecision.allowed, 'Suspended grant must fail closed.');

const missing = new BusinessAuthorizationService(
  new FakeGrantRepository(null),
  now,
);
const missingDecision = await missing.authorize({
  identity: { userId: 'user-1' },
  businessId: 'biz-1',
  capability: 'commerce.read',
});
assert(
  !missingDecision.allowed && missingDecision.reason === 'grant_not_found',
  'Missing grant must be denied explicitly.',
);

const wrongUser = new BusinessAuthorizationService(
  new FakeGrantRepository({ ...baseGrant, userId: 'user-2' }),
  now,
);
let wrongUserRejected = false;
try {
  await wrongUser.authorize({
    identity: { userId: 'user-1' },
    businessId: 'biz-1',
    capability: 'commerce.read',
  });
} catch (error) {
  wrongUserRejected = error instanceof Error && error.message.includes('wrong user');
}
assert(wrongUserRejected, 'Repository returning another user grant must fail closed.');

console.log('PASS: business authorization service tests');
