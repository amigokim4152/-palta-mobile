import type { OperatorConversationContextType } from '../core/operatorMessagingBridge.js';

export type BusinessMessagingIntent =
  | 'general_inquiry'
  | 'quote_followup'
  | 'reservation_question'
  | 'order_question';

export type BusinessMessagingStartInput = {
  businessId: string;
  businessName: string;
  intent: BusinessMessagingIntent;
  initialText?: string;
  relatedEntityId?: string;
};

export type BusinessMessagingConversationSeed = {
  contextType: Extract<
    OperatorConversationContextType,
    'business_customer' | 'quote' | 'booking' | 'order'
  >;
  businessId: string;
  displayName: string;
  purposeKey: string;
  sourceSurface: 'local_business_profile';
  initialText?: string;
  relatedEntityId?: string;
};

const contextByIntent: Record<
  BusinessMessagingIntent,
  BusinessMessagingConversationSeed['contextType']
> = {
  general_inquiry: 'business_customer',
  quote_followup: 'quote',
  reservation_question: 'booking',
  order_question: 'order',
};

const purposeByIntent: Record<BusinessMessagingIntent, string> = {
  general_inquiry: 'local_business_inquiry',
  quote_followup: 'local_business_quote_followup',
  reservation_question: 'local_business_reservation_question',
  order_question: 'local_business_order_question',
};

export function validateBusinessMessagingStart(
  input: BusinessMessagingStartInput,
): readonly string[] {
  const issues: string[] = [];
  if (!input.businessId.trim()) issues.push('business_id_required');
  if (!input.businessName.trim()) issues.push('business_name_required');
  if (input.initialText !== undefined) {
    const text = input.initialText.trim();
    if (!text) issues.push('initial_text_must_not_be_blank');
    if (text.length > 4000) issues.push('initial_text_too_long');
  }
  if (input.relatedEntityId !== undefined && !input.relatedEntityId.trim()) {
    issues.push('related_entity_id_must_not_be_blank');
  }
  return issues;
}

/**
 * Converts Local Business intent into a provider-neutral Shared Messaging seed.
 * It does not create or store a conversation. Conversation identity, messages,
 * delivery, read state and retention remain owned by Shared Messaging Core.
 */
export function buildBusinessMessagingConversationSeed(
  input: BusinessMessagingStartInput,
): BusinessMessagingConversationSeed {
  const issues = validateBusinessMessagingStart(input);
  if (issues.length) {
    throw new Error(`Invalid business messaging start: ${issues.join(',')}`);
  }

  return {
    contextType: contextByIntent[input.intent],
    businessId: input.businessId,
    displayName: input.businessName,
    purposeKey: purposeByIntent[input.intent],
    sourceSurface: 'local_business_profile',
    ...(input.initialText ? { initialText: input.initialText.trim() } : {}),
    ...(input.relatedEntityId
      ? { relatedEntityId: input.relatedEntityId.trim() }
      : {}),
  };
}
