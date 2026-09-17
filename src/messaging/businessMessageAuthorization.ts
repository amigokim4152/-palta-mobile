import type { BusinessRole } from '../security/businessRoles.js';
import { roleAllows } from '../security/businessRoles.js';
import type { MessageActorAuthorizationPort } from './authorizationPort.js';

export interface BusinessStaffDirectoryPort {
  findActiveRole(input: {
    businessId: string;
    principalUserId: string;
  }): Promise<BusinessRole | null>;
}

/**
 * Baseline business Message authorization.
 *
 * Fine-grained/custom employee overrides can be implemented behind
 * BusinessStaffDirectoryPort later without changing Message Core contracts.
 */
export class BusinessMessageActorAuthorization
  implements MessageActorAuthorizationPort {
  constructor(private readonly staff: BusinessStaffDirectoryPort) {}

  async canActAs(input: Parameters<MessageActorAuthorizationPort['canActAs']>[0]): Promise<boolean> {
    if (input.actor.actorType !== 'business') return false;
    if (input.actor.principalUserId !== input.principalUserId) return false;

    const role = await this.staff.findActiveRole({
      businessId: input.actor.actorId,
      principalUserId: input.principalUserId,
    });
    if (!role) return false;

    return roleAllows(
      role,
      input.operation === 'send'
        ? 'customer_message_reply'
        : 'customer_message_read',
    );
  }
}
