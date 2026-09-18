export type PropertyDetailDemo = {
  listingId: string;
  building?: {
    name: string;
    yearBuilt?: number;
    floors?: number;
    units?: number;
    parkingNote?: string;
  };
  highlights: string[];
  nearby: Array<{ label: string; detail: string }>;
  livedReview?: {
    title: string;
    body: string;
    tags: string[];
  };
  marketReference?: {
    label: string;
    value: string;
    disclaimer: string;
  };
};

/** UI-only detail enrichment. Replace per capability with authoritative data. */
export const PROPERTY_DETAIL_DEMO: readonly PropertyDetailDemo[] = [
  {
    listingId: 'demo-vitacura-001',
    building: {
      name: 'Edificio demo Parque Bicentenario',
      yearBuilt: 2018,
      floors: 12,
      units: 48,
      parkingNote: '2 estacionamientos en la publicación',
    },
    highlights: ['Terraza', 'Estacionamiento', 'Bodega', 'Cerca de parque'],
    nearby: [
      { label: 'Parque', detail: 'Contexto de mapa disponible' },
      { label: 'Colegios', detail: 'Conectar Neighborhood Core' },
      { label: 'Comercio', detail: 'Conectar Negocios cercanos' },
      { label: 'Transporte', detail: 'Conectar Journey Core' },
    ],
    livedReview: {
      title: 'Vivir aquí · demo',
      body: 'Bloque reservado para experiencias verificadas del edificio y su entorno. No representa una reseña real.',
      tags: ['Tranquilidad', 'Parques', 'Familias'],
    },
    marketReference: {
      label: 'Referencia de mercado',
      value: 'Pendiente de fuente verificada',
      disclaimer: 'Palta no mostrará un valor estimado como precio oficial sin una fuente trazable.',
    },
  },
  {
    listingId: 'demo-providencia-001',
    building: {
      name: 'Edificio demo Pedro de Valdivia',
      yearBuilt: 2015,
      floors: 16,
      units: 96,
      parkingNote: '1 estacionamiento en la publicación',
    },
    highlights: ['Metro cercano', 'Balcón', 'Estacionamiento'],
    nearby: [
      { label: 'Metro', detail: 'Distancia por Map Core' },
      { label: 'Supermercados', detail: 'Negocios cercanos' },
      { label: 'Salud', detail: 'Servicios cercanos' },
      { label: 'Parques', detail: 'Contexto de barrio' },
    ],
    livedReview: {
      title: 'Vivir aquí · demo',
      body: 'La experiencia residencial se organizará por transporte, ruido, comercio, seguridad percibida y vida familiar.',
      tags: ['Transporte', 'Comercio', 'Caminable'],
    },
  },
] as const;

export function findPropertyDetailDemo(listingId: string) {
  return PROPERTY_DETAIL_DEMO.find((item) => item.listingId === listingId);
}
