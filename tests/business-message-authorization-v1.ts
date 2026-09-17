import { BusinessMessageActorAuthorization } from '../src/messaging/businessMessageAuthorization.js';
import type { BusinessRole } from '../src/security/businessRoles.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const roles = new Map<string, BusinessRole>([
  ['owner-user', 'owner'],
  ['manager-user', 'manager'],
  ['cashier-user', 'cashier'],
  ['staff-user', 'staff'],
  ['kitchen-user', 'kitchen'],
  ['viewer-user', 'viewer'],
]);

const authorization = new BusinessMessageActorAuthorization({
  async findActiveRole(input) {
    if (input.businessId !== 'business-1') return null;
    return roles.get(input.principalUserId) ?? null;
  },
});

for (const principalUserId of [
  'owner-user',
  'manager-user',
  'cashier-user',
  'staff-user',
]) {
  const actor = {
    actorType: 'business' as const,
    actorId: 'business-1',
    principalUserId,
  };
  assert(
    await authorization.canActAs({ principalUserId, actor, operation: 'read' }),
    `${principalUserId} role should read customer messages by baseline policy.`,
  );
  assert(
    await authorization.canActAs({ principalUserId, actor, operation: 'send' }),
    `${principalUserId} role should reply to customer messages by baseline policy.`,
  );
}

for (const principalUserId of ['kitchen-user', 'viewer-user']) {
  const actor = {
    actorType: 'business' as const,
    actorId: 'business-1',
    principalUserId,
  };
  assert(
    !(await authorization.canActAs({ principalUserId, actor, operation: 'read' })),
    `${principalUserId} role must not receive customer Message access by default.`,
  );
  assert(
    !(await authorization.canActAs({ principalUserId, actor, operation: 'send' })),
    `${principalUserId} role must not reply as the business by default.`,
  );
}

assert(
  !(await authorization.canActAs({
    principalUserId: 'owner-user',
    actor: {
      actorType: 'business',
      actorId: 'business-1',
      principalUserId: 'different-user',
    },
    operation: 'send',
  })),
  'Business actor principal mismatch must always be denied.',
);

assert(
  !(await authorization.canActAs({
    principalUserId: 'owner-user',
    actor: {
      actorType: 'organization',
      actorId: 'organization-1',
      principalUserId: 'owner-user',
    },
    operation: 'read',
  })),
  'Business adapter must not authorize organization/community actors.',
);

console.log('Business Message authorization tests passed.');
