import type {
  MarketCategoryKey,
  MarketTradeMode,
} from '../../../../src/market/marketCatalog';

export type MarketListingStatus = 'active' | 'reserved';

export type MarketPreviewListing = {
  id: string;
  title: string;
  priceClp?: number;
  tradeMode: MarketTradeMode;
  category: Exclude<MarketCategoryKey, 'all'>;
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

/** Development-only visual fixtures. Production data must come from Mercado data services. */
export const marketPreviewListings: MarketPreviewListing[] = [
  {
    id: 'preview-bike-01',
    title: 'Bicicleta urbana en muy buen estado',
    priceClp: 120000,
    tradeMode: 'sale',
    category: 'sports',
    comuna: 'Vitacura',
    distanceKm: 1.2,
    ageLabel: 'hace 15 min',
    favorites: 8,
    chats: 3,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=600&q=80',
    sellerName: 'María',
    description:
      'Bicicleta urbana cuidada, frenos y cambios funcionando bien. Entrega cerca de Parque Bicentenario.',
  },
  {
    id: 'preview-chair-02',
    title: 'Silla de comedor de madera',
    priceClp: 28000,
    tradeMode: 'sale',
    category: 'home',
    comuna: 'Las Condes',
    distanceKm: 2.6,
    ageLabel: 'hace 38 min',
    favorites: 14,
    chats: 5,
    status: 'reserved',
    imageUrl:
      'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Tomás',
    description:
      'Silla firme y limpia. Tiene pequeñas marcas normales de uso. Retiro coordinado por mensaje.',
  },
  {
    id: 'preview-camera-03',
    title: 'Cámara compacta con batería',
    priceClp: 95000,
    tradeMode: 'sale',
    category: 'tech',
    comuna: 'Providencia',
    distanceKm: 4.1,
    ageLabel: 'hace 1 h',
    favorites: 21,
    chats: 7,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Diego',
    description:
      'Incluye batería, cargador y correa. Se puede probar al momento de la entrega.',
  },
  {
    id: 'preview-shoes-04',
    title: 'Zapatillas deportivas talla 40',
    priceClp: 35000,
    tradeMode: 'sale',
    category: 'fashion',
    comuna: 'Vitacura',
    distanceKm: 0.9,
    ageLabel: 'hace 2 h',
    favorites: 5,
    chats: 1,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Camila',
    description: 'Muy poco uso. Se entregan limpias y con su caja.',
  },
  {
    id: 'preview-free-05',
    title: 'Caja de libros infantiles',
    tradeMode: 'free',
    category: 'kids',
    comuna: 'Lo Barnechea',
    distanceKm: 5.3,
    ageLabel: 'hace 3 h',
    favorites: 19,
    chats: 9,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Paula',
    description:
      'Libros usados pero completos. Prefiero entregarlos todos juntos a una familia que los aproveche.',
  },
];
