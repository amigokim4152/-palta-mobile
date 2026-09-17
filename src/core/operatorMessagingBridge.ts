export type OperatorConversationContextType =
  | 'support'
  | 'business_owner'
  | 'business_customer'
  | 'claim'
  | 'quote'
  | 'booking'
  | 'order'
  | 'other';

export type OperatorMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'external_user' | 'operator' | 'system';
  bodyText: string;
  createdAt: string;
};

export type OperatorConversationSummary = {
  conversationId: string;
  displayName: string;
  contextType: OperatorConversationContextType;
  businessId?: string;
  lastMessageAt: string;
  needsOperatorReply: boolean;
  unresolvedCommitment?: string;
};

export type OperatorConversationContextProjection = {
  conversation: OperatorConversationSummary;
  recentMessages: readonly OperatorMessage[];
  permittedFacts: readonly {
    key: string;
    value: string;
    sourceRef?: string;
  }[];
};

export type ReviewedOperatorReply = {
  conversationId: string;
  bodyText: string;
  sourceLanguage: string;
  deliveryLanguage: 'es-CL' | string;
  reviewedByOperatorId: string;
  reviewedAt: string;
};

/**
 * Logical adapter contract only. It does not implement a second Messaging Core.
 * The real messaging transport/storage owns conversations and messages; this
 * bridge exposes the minimum authorized projection needed for operator work.
 */
export interface OperatorMessagingBridge {
  listNeedsAttention(input?: { limit?: number }): Promise<readonly OperatorConversationSummary[]>;
  getConversationContext(conversationId: string): Promise<OperatorConversationContextProjection>;
  sendReviewedReply(reply: ReviewedOperatorReply): Promise<{ messageId: string; sentAt: string }>;
}

export function validateOperatorContextProjection(
  projection: OperatorConversationContextProjection,
): readonly string[] {
  const issues: string[] = [];
  if (!projection.conversation.conversationId.trim()) issues.push('conversation_id_required');

  for (const message of projection.recentMessages) {
    if (message.conversationId !== projection.conversation.conversationId) {
      issues.push('cross_conversation_message_not_allowed');
      break;
    }
    if (!message.bodyText.trim()) {
      issues.push('empty_message_body_not_allowed');
      break;
    }
  }

  return issues;
}

/**
 * Palta's founder/operator flow is AI-assisted, not AI-autonomous. The final
 * outbound operator reply needs explicit human review metadata.
 */
export function validateReviewedOperatorReply(
  reply: ReviewedOperatorReply,
): readonly string[] {
  const issues: string[] = [];
  if (!reply.conversationId.trim()) issues.push('conversation_id_required');
  if (!reply.bodyText.trim()) issues.push('body_text_required');
  if (!reply.reviewedByOperatorId.trim()) issues.push('operator_review_required');
  if (!Number.isFinite(Date.parse(reply.reviewedAt))) issues.push('valid_review_time_required');
  return issues;
}
