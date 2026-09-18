import { assemblePlaySources } from '../../../../src/play/playSourceAssembler';
import type { PlayDiscoveryItem } from '../../../../src/play/playDiscovery';

/**
 * Development-only source fixtures.
 * They intentionally enter through the same Municipal + Business + Catalog
 * projection pipeline as real data so visual review exercises production domain
 * logic. Production must never present these records as real events/businesses.
 */
const previewAssembly = assemblePlaySources({
  calendar: {
    todayIsoDate: '2026-09-18',
    weekendIsoDates: ['2026-09-19', '2026-09-20'],
  },
  municipalEvents: [
    {
      id: 'preview-vitacura-family-workshop',
      title: 'Taller familiar en centro cultural',
      comuna: 'Vitacura',
      venue: 'Centro cultural',
      startDate: '2026-09-18',
      startTime: '16:00',
      isFree: true,
      requiresRegistration: true,
      audience: 'Familias',
      category: 'workshop',
      imageUrl: 'https://picsum.photos/seed/palta-family-workshop/900/600',
      sourceName: 'Municipalidad · ejemplo',
    },
    {
      id: 'preview-las-condes-outdoor',
      title: 'Actividad al aire libre para niños',
      comuna: 'Las Condes',
      venue: 'Parque comunal',
      startDate: '2026-09-18',
      startTime: '17:30',
      isFree: true,
      audience: 'Niños y familias',
      category: 'sports',
      outdoor: true,
      imageUrl: 'https://picsum.photos/seed/palta-outdoor-kids/900/600',
      sourceName: 'Municipalidad · ejemplo',
    },
    {
      id: 'preview-nunoa-weekend',
      title: 'Feria y actividades de fin de semana',
      comuna: 'Ñuñoa',
      venue: 'Plaza comunal',
      startDate: '2026-09-19',
      startTime: '11:00',
      isFree: true,
      audience: 'Todo público',
      category: 'market',
      imageUrl: 'https://picsum.photos/seed/palta-weekend-fair/900/600',
      sourceName: 'Municipalidad · ejemplo',
    },
  ],
  publicPrograms: [
    {
      id: 'preview-providencia-culture',
      sourceKind: 'public_program',
      contentKind: 'concert',
      title: 'Música y cultura en el barrio',
      comuna: 'Providencia',
      venue: 'Espacio público',
      scheduleLabel: 'Hoy · 19:00',
      startAt: '2026-09-18T19:00:00-03:00',
      isFree: true,
      audienceLabel: 'Todo público',
      distanceLabel: '22 min',
      experienceTags: ['Música', 'Cultura', 'Gratis'],
      imageUrl: 'https://picsum.photos/seed/palta-music-public/900/600',
      themeTags: ['today', 'free', 'outdoor'],
      source: { authority: 'Agenda pública · ejemplo' },
    },
  ],
  catalogItems: [
    {
      id: 'preview-catalog-movie',
      sourceKind: 'partner_feed',
      contentKind: 'movie',
      title: 'Película en cartelera cerca de ti',
      comuna: 'Las Condes',
      venue: 'Cine · ejemplo',
      scheduleLabel: 'Hoy · funciones desde 18:10',
      startAt: '2026-09-18T18:10:00-03:00',
      priceLabel: 'Entradas disponibles',
      distanceLabel: '14 min',
      experienceTags: ['Cine', 'Cartelera'],
      imageUrl: 'https://picsum.photos/seed/palta-cinema-showtime/900/600',
      themeTags: ['today'],
      source: { authority: 'Cartelera · ejemplo' },
    },
    {
      id: 'preview-catalog-performance',
      sourceKind: 'partner_feed',
      contentKind: 'live_performance',
      title: 'Espectáculo familiar este fin de semana',
      comuna: 'Providencia',
      venue: 'Sala · ejemplo',
      scheduleLabel: 'Este finde · 17:00',
      startAt: '2026-09-19T17:00:00-03:00',
      priceLabel: 'Ver entradas',
      distanceLabel: '21 min',
      audienceLabel: 'Familiar',
      experienceTags: ['Espectáculo', 'Familia'],
      imageUrl: 'https://picsum.photos/seed/palta-live-performance/900/600',
      themeTags: ['weekend', 'family'],
      source: { authority: 'Cartelera · ejemplo' },
    },
  ],
  businessExposures: [
    {
      businessId: 'preview-business-birthday-pool',
      offeringId: 'preview-offering-birthday-pool',
      exposureReason: 'birthday_pool',
      contentKind: 'birthday',
      ownerManaged: false,
      title: 'Cumpleaños con piscina',
      comuna: 'Chicureo',
      scheduleLabel: 'Reserva previa',
      audienceLabel: '5–12 años · 15–30 personas',
      priceLabel: 'Desde $300.000',
      distanceLabel: '32 min',
      experienceTags: ['Piscina', 'Aire libre', 'Cumpleaños'],
      imageUrl: 'https://picsum.photos/seed/palta-birthday-pool/900/600',
      playTags: ['birthday', 'family', 'outdoor'],
      sourceAuthority: 'Negocio · ejemplo',
    },
    {
      businessId: 'preview-business-birthday-indoor',
      offeringId: 'preview-offering-birthday-indoor',
      exposureReason: 'birthday_indoor',
      contentKind: 'birthday',
      ownerManaged: false,
      title: 'Cumpleaños indoor y juegos',
      comuna: 'Las Condes',
      scheduleLabel: 'Reserva previa',
      audienceLabel: '4–10 años · hasta 20 personas',
      priceLabel: 'Paquetes disponibles',
      distanceLabel: '15 min',
      experienceTags: ['Indoor', 'Juegos', 'Cumpleaños'],
      imageUrl: 'https://picsum.photos/seed/palta-birthday-indoor/900/600',
      playTags: ['birthday', 'family'],
      sourceAuthority: 'Negocio · ejemplo',
    },
  ],
});

export const playPreviewItems: readonly PlayDiscoveryItem[] = previewAssembly.items.map((item) => {
  if (item.id === 'municipal:preview-vitacura-family-workshop') {
    return { ...item, distanceLabel: 'Cerca de ti' };
  }
  if (item.id === 'municipal:preview-las-condes-outdoor') {
    return { ...item, distanceLabel: '18 min' };
  }
  if (item.id === 'municipal:preview-nunoa-weekend') {
    return { ...item, distanceLabel: '28 min' };
  }
  return item;
});
