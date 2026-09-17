import type { ActorRef } from './contracts.js';

/**
 * Server-side authorization boundary used before a principal may speak as an
 * actor such as a business or organization. The client may request an acting
 * actor, but never proves the authority itself.
 */
export interface MessageActorAuthorizationPort {
  canActAs(input: {
    principalUserId: string;
    actor: ActorRef;
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
