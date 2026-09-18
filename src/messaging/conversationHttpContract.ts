function requiredPathId(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  return encodeURIComponent(normalized);
}

/**
 * Canonical public HTTP entry points for durable Message Core relationships.
 * Product domains may call these routes, but must not invent their own
 * conversation identity or persistence semantics.
 */
export const conversationHttpContract = {
  openBusinessConversation(businessId: string): string {
    return `/v1/messages/businesses/${requiredPathId(businessId, 'businessId')}/conversation`;
  },

  openDirectUserConversation(counterpartUserId: string): string {
    return `/v1/messages/users/${requiredPathId(counterpartUserId, 'counterpartUserId')}/conversation`;
  },
} as const;
