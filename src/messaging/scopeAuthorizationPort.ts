import type {
  ActorRef,
  ResourceRef,
  ScopeAccessMode,
} from './contracts.js';

/**
 * Owning-domain authorization boundary for linking canonical domain resources
 * into Message Core. The evidence reference is opaque and non-secret; the
 * adapter talks to the owning core or verifies its signed/internal result.
 */
export interface ScopeResourceAuthorizationPort {
  canLink(input: {
    conversationId: string;
    requestedBy: ActorRef;
    sourceCore: string;
    resource: ResourceRef;
    authorizationEvidenceRef: string;
    accessMode: ScopeAccessMode;
  }): Promise<boolean>;
}
