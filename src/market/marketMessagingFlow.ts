import type { MarketMutationPort } from './marketApiContract.js';
import type { MarketMessageIntent } from './marketMessageIntent.js';
import type { MarketTransactionStatus } from './marketPersistenceContract.js';

export type MarketConversationFocus = {
  sourceCore: 'market';
  resourceType: 'market_transaction';
  resourceId: string;
  label: string;
};

/**
 * Shared Message Core bridge used by Mercado.
 *
 * The Message Core owns durable relationship identity. Mercado only asks for a
 * peer conversation and then opens it focused on a canonical Market transaction.
 * Scope creation/linking remains an internal Message/Core integration concern;
 * the mobile feature never creates ConversationScope rows directly.
 */
export interface MarketMessagingPort {
  ensurePeerConversation(input: {
    counterpartyUserId: string;
  }): Promise<{ conversationId: string }>;
  openConversation(input: {
    conversationId: string;
    focus: MarketConversationFocus;
    initialText?: string;
  }): Promise<void>;
}

export type OpenMarketMessagingResult = {
  conversationId: string;
  transactionId: string;
  transactionStatus: MarketTransactionStatus;
};

/**
 * Convergent Mercado -> Message Core orchestration.
 *
 * Order matters:
 * 1. Message Core ensures/reuses the durable buyer<->seller relationship.
 * 2. Mercado ensures/reuses the buyer's active transaction for this listing.
 * 3. Messaging opens the durable conversation focused on that transaction.
 *
 * Starting a conversation never reserves a listing. If step 3 fails after the
 * transaction exists, a retry must converge on the same active transaction and
 * durable conversation rather than creating duplicates.
 */
export async function openMarketMessagingFlow(input: {
  intent: MarketMessageIntent;
  market: Pick<MarketMutationPort, 'startTransaction'>;
  messaging: MarketMessagingPort;
}): Promise<OpenMarketMessagingResult> {
  const conversation = await input.messaging.ensurePeerConversation({
    counterpartyUserId: input.intent.counterparty.actorId,
  });

  if (!conversation.conversationId.trim()) {
    throw new Error('Message Core returned an empty conversation id.');
  }

  const transaction = await input.market.startTransaction({
    listingId: input.intent.listing.id,
    conversationId: conversation.conversationId,
  });

  if (
    transaction.conversationId &&
    transaction.conversationId !== conversation.conversationId
  ) {
    throw new Error(
      'Mercado transaction is linked to a different durable conversation.',
    );
  }

  if (!transaction.conversationId) {
    throw new Error(
      'Mercado transaction did not persist the durable conversation reference.',
    );
  }

  await input.messaging.openConversation({
    conversationId: transaction.conversationId,
    focus: {
      sourceCore: 'market',
      resourceType: 'market_transaction',
      resourceId: transaction.id,
      label: transaction.listingSnapshot.title,
    },
    ...(input.intent.initialText
      ? { initialText: input.intent.initialText }
      : {}),
  });

  return {
    conversationId: transaction.conversationId,
    transactionId: transaction.id,
    transactionStatus: transaction.status,
  };
}
