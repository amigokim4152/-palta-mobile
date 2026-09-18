export type MarketMessagePreset =
  | 'availability'
  | 'pickup'
  | 'offer'
  | 'coordinate';

export const marketMessagePresetText: Record<MarketMessagePreset, string> = {
  availability: 'Hola, ¿todavía está disponible?',
  pickup: 'Hola, ¿en qué sector podríamos coordinar la entrega?',
  offer: 'Hola, ¿el precio es conversable?',
  coordinate: 'Hola, me interesa. ¿Podemos coordinar?',
};

/**
 * Mercado-owned intent for contacting a seller.
 *
 * Conversation identity deliberately does not include the listing. Message Core
 * owns the durable buyer<->seller relationship; Mercado later creates/ensures a
 * transaction for this listing and asks Messaging to focus that relationship on
 * the resulting market_transaction context.
 */
export interface MarketMessageIntent {
  sourceCore: 'market';
  listing: {
    id: string;
    title: string;
  };
  counterparty: {
    actorType: 'user';
    actorId: string;
  };
  initialText?: string;
}

export function buildMarketMessageIntent(input: {
  listingId: string;
  listingTitle: string;
  sellerActorId: string;
  preset?: MarketMessagePreset;
}): MarketMessageIntent {
  return {
    sourceCore: 'market',
    listing: {
      id: input.listingId,
      title: input.listingTitle,
    },
    counterparty: {
      actorType: 'user',
      actorId: input.sellerActorId,
    },
    ...(input.preset
      ? { initialText: marketMessagePresetText[input.preset] }
      : {}),
  };
}
