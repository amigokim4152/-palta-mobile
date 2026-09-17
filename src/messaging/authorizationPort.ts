import type { ActorRef } from './contracts.js';

export type MessageActorOperation = 'read' | 'send';

/**
 * Server-side authorization boundary used before a principal may act as a
 * business/organization/community actor. Read and send are deliberately
 * separate operations: a staff member who may inspect an inbox does not
 * automatically gain authority to reply as the business.
 */
export interface MessageActorAuthorizationPort {
  canActAs(input: {
    principalUserId: string;
    actor: ActorRef;
    operation: MessageActorOperation;
  }): Promise<boolean>;
}

/**
 * User actors are self-authorizing only when the authenticated principal and
 * actor ID are identical. Business/organization/community/support actors must
 * be verified by MessageActorAuthorizationPort.
 */
export function selfAuthorizesUserActor(
  principalUserId: string,
  actor: ActorRef,
): boolean {
  return (
    actor.actorType === 'user' &&
    actor.actorId === principalUserId &&
    (actor.principalUserId === undefined ||
      actor.principalUserId === principalUserId)
  );
}
