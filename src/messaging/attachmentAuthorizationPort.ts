import type {
  ActorRef,
  MessageAttachmentDraft,
} from './contracts.js';

/**
 * Asset Core authorization boundary. A client-provided assetId is never enough
 * to prove that the authenticated principal may attach that asset to a message.
 * Implementations should verify ownership/access, upload completion and asset
 * usability without exposing storage-provider URLs to Message Core.
 */
export interface MessageAttachmentAuthorizationPort {
  canAttach(input: {
    principalUserId: string;
    actor: ActorRef;
    attachment: MessageAttachmentDraft;
  }): Promise<boolean>;
}
