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

/** Development-only visual fixtures. Production data must come from Mercado data services. */
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
    id: 'preview-car-06',
    vertical: 'vehicles',
    title: 'Toyota RAV4 2021 automática',
    priceClp: 17990000,
    tradeMode: 'sale',
    category: 'hobby',
    comuna: 'Las Condes',
    distanceKm: 3.4,
    ageLabel: 'hace 24 min',
    favorites: 12,
    chats: 4,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Andrés',
    description:
      'Toyota RAV4 2021, transmisión automática, 52.000 km. Mantenciones al día y documentación disponible para revisar antes de coordinar una visita.',
  },
  {
    id: 'preview-property-sale-07',
    vertical: 'property',
    title: 'Departamento 2D 2B cerca de Metro Tobalaba',
    priceClp: 285000000,
    tradeMode: 'sale',
    category: 'home',
    comuna: 'Providencia',
    distanceKm: 4.8,
    ageLabel: 'hace 42 min',
    favorites: 17,
    chats: 6,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Corredora Andes',
    description:
      'Departamento de 2 dormitorios y 2 baños, 78 m² aproximados, estacionamiento y bodega. La ubicación pública se muestra por sector, no por dirección exacta.',
  },
  {
    id: 'preview-property-rent-08',
    vertical: 'property',
    title: 'Arriendo departamento 1D con estacionamiento',
    priceClp: 890000,
    tradeMode: 'rent',
    category: 'home',
    comuna: 'Ñuñoa',
    distanceKm: 7.2,
    ageLabel: 'hace 1 h',
    favorites: 9,
    chats: 5,
    status: 'active',
    imageUrl:
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=80',
    sellerName: 'Carolina',
    description:
      'Departamento de 1 dormitorio, terraza y estacionamiento. Canon mensual publicado; condiciones y documentos se coordinan por mensaje.',
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
