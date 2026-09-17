export interface CareResourceAuthorizationPort {
  /**
   * Owning domain verifies that the authenticated principal may associate the
   * requested canonical resource with their Care track. This must not rely on
   * client-supplied customer identity or contact data.
   */
  canLinkResource(input: {
    principalUserId: string;
    sourceCore: string;
    resourceType: string;
    resourceId: string;
  }): Promise<boolean>;
}
