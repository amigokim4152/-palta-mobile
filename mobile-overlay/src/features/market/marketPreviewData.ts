import type {
  MarketCategoryKey,
  MarketTradeMode,
} from '../../../../src/market/marketCatalog';
import type { MarketListingStatus } from '../../../../src/market/marketLifecycle';

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
    id: 'preview-bike-01',
    vertical: 'secondhand',
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
    vertical: 'secondhand',
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
    vertical: 'secondhand',
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
    vertical: 'secondhand',
    title: 'Zapatillas deportivas talla 40',
    priceClp: 35000,
    tradeMode: 'sale',
    category: 'fashion',
    comuna: 'Ñuñoa',
    distanceKm: 6.4,
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
    vertical: 'secondhand',
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
  {
    id: 'preview-coffee-06',
    vertical: 'secondhand',
    title: 'Cafetera italiana + molino manual',
    tradeMode: 'exchange',
    category: 'home',
    comuna: 'La Reina',
    distanceKm: 8.0,
    ageLabel: 'hace 4 h',
    favorites: 11,
    chats: 4,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Felipe',
    description:
      'Cafetera italiana y molino manual funcionando bien. Me interesa intercambio por accesorios de cocina o una planta de interior.',
  },
  {
    id: 'preview-produce-09',
    vertical: 'local_produce',
    title: 'Caja semanal de verduras de temporada',
    priceClp: 18000,
    tradeMode: 'sale',
    category: 'home',
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
