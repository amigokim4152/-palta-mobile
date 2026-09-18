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

export interface DirectUserConversationEligibilityPort {
  /**
   * Shared Identity/Safety policy decides whether the initiating user may open
   * or reuse a direct Palta conversation with the counterpart. Implementations
   * may account for account state, blocks, abuse controls, age/safety policy,
   * or other cross-domain restrictions. Message Core only consumes the result.
   */
  canOpenDirectUserConversation(input: {
    initiatorUserId: string;
    counterpartUserId: string;
  }): Promise<boolean>;
}
