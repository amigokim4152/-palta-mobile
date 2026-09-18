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

export interface MarketMessageIntent {
  conversationType: 'transaction';
  sourceCore: 'market';
  context: {
    relation: 'listing';
    resourceType: 'market_listing';
    resourceId: string;
    label: string;
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
    conversationType: 'transaction',
    sourceCore: 'market',
    context: {
      relation: 'listing',
      resourceType: 'market_listing',
      resourceId: input.listingId,
      label: input.listingTitle,
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
