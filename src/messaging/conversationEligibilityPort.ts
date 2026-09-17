export interface BusinessConversationEligibilityPort {
  /**
   * Business Core decides whether Palta internal inquiry is currently available
   * for this business (claimed/eligible/settings/policy). Message Core does not
   * duplicate business verification or contact-channel state.
   */
  canOpenUserBusinessConversation(input: {
    userId: string;
    businessId: string;
  }): Promise<boolean>;
}
