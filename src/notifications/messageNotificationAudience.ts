import type { BusinessRole } from '../security/businessRoles.js';
import { roleAllows } from '../security/businessRoles.js';
import type { ActorRef } from '../messaging/contracts.js';
import type { MessageNotificationAudiencePort } from './notificationCandidateConsumer.js';

export interface MessageAudienceParticipant {
  actor: ActorRef;
  muted: boolean;
}

export interface MessageAudienceContext {
  sender: ActorRef;
  participants: MessageAudienceParticipant[];
}

export interface MessageAudienceContextPort {
  load(input: {
    conversationId: string;
    messageId: string;
  }): Promise<MessageAudienceContext | null>;
}

export interface BusinessNotificationStaffDirectoryPort {
  listActiveStaff(input: {
    businessId: string;
  }): Promise<Array<{
    principalUserId: string;
    role: BusinessRole;
  }>>;
}

export interface NonUserActorNotificationAudiencePort {
  resolve(input: {
    actor: ActorRef;
  }): Promise<string[]>;
}

function sameActor(left: ActorRef, right: ActorRef): boolean {
  return left.actorType === right.actorType && left.actorId === right.actorId;
}

/**
 * Expands relationship actors into real user principals for delivery.
 * Message body/content is not needed for this operation.
 */
export class MessageNotificationAudienceService
  implements MessageNotificationAudiencePort {
  constructor(
    private readonly context: MessageAudienceContextPort,
    private readonly businessStaff: BusinessNotificationStaffDirectoryPort,
    private readonly otherActors?: NonUserActorNotificationAudiencePort,
  ) {}

  private async principalsForActor(actor: ActorRef): Promise<string[]> {
    if (actor.actorType === 'user') return [actor.actorId];

    if (actor.actorType === 'business') {
      const staff = await this.businessStaff.listActiveStaff({
        businessId: actor.actorId,
      });
      return staff
        .filter((member) => roleAllows(member.role, 'customer_message_read'))
        .map((member) => member.principalUserId);
    }

    return this.otherActors?.resolve({ actor }) ?? [];
  }

  async resolveRecipients(input: {
    conversationId: string;
    messageId: string;
  }): Promise<Array<{ recipientUserId: string }>> {
    const context = await this.context.load(input);
    if (!context) return [];

    const recipients = new Set<string>();
    for (const participant of context.participants) {
      if (participant.muted || sameActor(participant.actor, context.sender)) continue;
      const principals = await this.principalsForActor(participant.actor);
      for (const principal of principals) {
        const normalized = principal.trim();
        if (normalized) recipients.add(normalized);
      }
    }

    return [...recipients].map((recipientUserId) => ({ recipientUserId }));
  }
}
