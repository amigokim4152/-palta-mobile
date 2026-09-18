import {
  canPerformBusinessOperation,
  type BusinessOperationalCapability,
  type BusinessOperationalGrant,
} from './businessOperationalAccess.js';
import {
  assertVerifiedUserIdentity,
  type VerifiedUserIdentity,
} from '../auth/serverIdentity.js';
import type { BusinessOperationalGrantRepository } from '../persistence/businessOperationalGrantRepository.js';

export type BusinessAuthorizationDecision =
  | {
      allowed: true;
      grant: BusinessOperationalGrant;
    }
  | {
      allowed: false;
      reason: 'grant_not_found' | 'operation_not_allowed';
    };

export class BusinessAuthorizationService {
  constructor(
    private readonly grants: BusinessOperationalGrantRepository,
    private readonly now: () => string,
  ) {}

  async authorize(input: {
    identity: VerifiedUserIdentity;
    businessId: string;
    capability: BusinessOperationalCapability;
  }): Promise<BusinessAuthorizationDecision> {
    assertVerifiedUserIdentity(input.identity);
    if (!input.businessId.trim()) throw new Error('businessId is required.');

    const grant = await this.grants.findGrant({
      businessId: input.businessId,
      userId: input.identity.userId,
    });

    if (!grant) {
      return { allowed: false, reason: 'grant_not_found' };
    }

    if (grant.userId !== input.identity.userId) {
      throw new Error('Business grant repository returned a grant for the wrong user.');
    }

    const allowed = canPerformBusinessOperation({
      grant,
      businessId: input.businessId,
      capability: input.capability,
      now: this.now(),
    });

    if (!allowed) {
      return { allowed: false, reason: 'operation_not_allowed' };
    }

    return { allowed: true, grant };
  }
}
