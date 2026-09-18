import type {
  MarketCategoryKey,
  MarketTradeMode,
} from '../../../../src/market/marketCatalog';
import type { MarketListingStatus } from '../../../../src/market/marketLifecycle';
import {
  rankMarketRecommendations,
  type MarketRecommendationReason,
} from '../../../../src/market/marketRecommendation';

export type MarketPreviewVertical =
  | 'secondhand'
  | 'vehicles'
  | 'property'
  | 'local_produce';

export type MarketPreviewTradeMode = MarketTradeMode | 'rent';

export type MarketPreviewListing = {
  id: string;
  vertical: MarketPreviewVertical;
  title: string;
  priceClp?: number;
  tradeMode: MarketPreviewTradeMode;
  category: Exclude<MarketCategoryKey, 'all'>;
  /** Preview-only product family used to validate related-item UX. */
  recommendationGroup?: string;
  comuna: string;
  distanceKm: number;
  ageLabel: string;
  favorites: number;
  chats: number;
  status: MarketListingStatus;
  imageUrl: string;
  sellerName: string;
  description: string;
};

export type MarketPreviewRecommendation = {
  listing: MarketPreviewListing;
  score: number;
  reasons: MarketRecommendationReason[];
};

/**
 * Development-only visual fixtures.
 *
 * The Mercado home intentionally keeps six secondhand fixtures with varied
 * comunas, prices and lifecycle states so list-card behavior can be checked
 * quickly on mobile/PWA. Autos and Propiedades keep their own vertical demo
 * data instead of being duplicated here.
 * Production data must come from Mercado data services.
 */
export const marketPreviewListings: MarketPreviewListing[] = [
  {
    id: 'preview-iphone-01',
    vertical: 'secondhand',
    title: 'iPhone 14 128 GB · muy buen estado',
    priceClp: 430000,
    tradeMode: 'sale',
    category: 'tech',
    recommendationGroup: 'smartphone',
    comuna: 'Vitacura',
    distanceKm: 1.1,
    ageLabel: 'hace 15 min',
    favorites: 18,
    chats: 6,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?auto=format&fit=crop&w=600&q=80',
    sellerName: 'María',
    description:
      'iPhone 14 de 128 GB, batería en buen estado y sin reparaciones. Se puede revisar y probar antes de coordinar la compra.',
  },
  {
    id: 'preview-galaxy-02',
    vertical: 'secondhand',
    title: 'Samsung Galaxy S23 256 GB',
    priceClp: 390000,
    tradeMode: 'sale',
    category: 'tech',
    recommendationGroup: 'smartphone',
    comuna: 'Las Condes',
    distanceKm: 2.7,
    ageLabel: 'hace 32 min',
    favorites: 15,
    chats: 5,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Tomás',
    description:
      'Galaxy S23 de 256 GB con caja y cable. Pantalla y cámaras funcionando correctamente; disponible para revisar en un punto acordado.',
  },
  {
    id: 'preview-iphone-03',
    vertical: 'secondhand',
    title: 'iPhone 13 128 GB · con caja',
    priceClp: 330000,
    tradeMode: 'sale',
    category: 'tech',
    recommendationGroup: 'smartphone',
    comuna: 'Providencia',
    distanceKm: 4.0,
    ageLabel: 'hace 48 min',
    favorites: 24,
    chats: 8,
    status: 'reserved',
    imageUrl:
      'https://images.unsplash.com/photo-1632661674596-df8be070a5c5?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Diego',
    description:
      'iPhone 13 de 128 GB con caja. Tiene marcas leves de uso y está reservado mientras se coordina una revisión.',
  },
  {
    id: 'preview-bike-04',
    vertical: 'secondhand',
    title: 'Bicicleta urbana aro 28',
    priceClp: 120000,
    tradeMode: 'sale',
    category: 'sports',
    recommendationGroup: 'urban_bike',
    comuna: 'Ñuñoa',
    distanceKm: 6.2,
    ageLabel: 'hace 1 h',
    favorites: 8,
    chats: 3,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Camila',
    description:
      'Bicicleta urbana cuidada, frenos y cambios funcionando bien. Entrega en un punto público acordado.',
  },
  {
    id: 'preview-chair-05',
    vertical: 'secondhand',
    title: 'Silla de comedor de madera',
    priceClp: 28000,
    tradeMode: 'sale',
    category: 'home',
    recommendationGroup: 'dining_chair',
    comuna: 'Lo Barnechea',
    distanceKm: 5.4,
    ageLabel: 'hace 2 h',
    favorites: 14,
    chats: 5,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Paula',
    description:
      'Silla firme y limpia. Tiene pequeñas marcas normales de uso. Retiro coordinado por mensaje.',
  },
  {
    id: 'preview-free-06',
    vertical: 'secondhand',
    title: 'Caja de libros infantiles',
    tradeMode: 'free',
    category: 'kids',
    recommendationGroup: 'kids_books',
    comuna: 'La Reina',
    distanceKm: 8.0,
    ageLabel: 'hace 3 h',
    favorites: 19,
    chats: 9,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Felipe',
    description:
      'Libros usados pero completos. Prefiero entregarlos todos juntos a una familia que los aproveche.',
  },
  {
    id: 'preview-produce-09',
    vertical: 'local_produce',
    title: 'Caja semanal de verduras de temporada',
    priceClp: 18000,
    tradeMode: 'sale',
    category: 'home',
    recommendationGroup: 'produce_box',
    comuna: 'La Reina',
    distanceKm: 8.1,
    ageLabel: 'hace 55 min',
    favorites: 6,
    chats: 2,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Huerta La Reina',
    description:
      'Caja con verduras de temporada preparadas para retiro semanal. Disponibilidad y punto de entrega se confirman antes de pagar o desplazarse.',
  },
];

function toRecommendationCandidate(listing: MarketPreviewListing) {
  return {
    listingId: listing.id,
    vertical: listing.vertical,
    category: listing.category,
    tradeMode: listing.tradeMode,
    status: listing.status,
    productFamilyKey: listing.recommendationGroup,
    priceClp: listing.priceClp,
    distanceKm: listing.distanceKm,
  };
}

export function marketPreviewRecommendations(
  listingId: string,
  limit = 3,
): MarketPreviewRecommendation[] {
  const current = marketPreviewListings.find((item) => item.id === listingId);
  if (!current) return [];

  const ranked = rankMarketRecommendations({
    seed: toRecommendationCandidate(current),
    candidates: marketPreviewListings.map(toRecommendationCandidate),
    limit,
  });
  const byId = new Map(marketPreviewListings.map((item) => [item.id, item]));

  return ranked.flatMap((item) => {
    const listing = byId.get(item.listingId);
    return listing ? [{ listing, score: item.score, reasons: item.reasons }] : [];
  });
}

export function marketPreviewRecommendationIds(
  listingId: string,
  limit = 3,
): string[] {
  return marketPreviewRecommendations(listingId, limit).map((item) => item.listing.id);
}
