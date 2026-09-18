export type DemoHomeEntry = {
  capabilityKey: string;
  title: string;
  detail: string;
  target?: string;
};

/**
 * Complete-development Home entry inventory.
 *
 * This is deliberately visual-only/demo scaffolding. It makes every product
 * entry capability visible before each destination route is implemented.
 * Entries without a real route are rendered as non-pressable rows rather than
 * fake buttons. Production placement can change later without deleting the
 * capability itself.
 */
export const DEMO_HOME_ENTRIES: readonly DemoHomeEntry[] = [
  { capabilityKey: 'entry.search', title: 'Buscar', detail: 'Buscar en Palta', target: '/search' },
  { capabilityKey: 'entry.nearby', title: 'Cerca de mí', detail: 'Lugares y actividad útil cerca' },
  { capabilityKey: 'entry.local_business', title: 'Negocios', detail: 'Comercios y servicios locales', target: '/(tabs)/neighborhood' },
  { capabilityKey: 'entry.real_estate', title: 'Propiedades', detail: 'Compra, arriendo y vivienda' },
  { capabilityKey: 'entry.community', title: 'Comunidad', detail: 'Tus comunidades y barrio', target: '/(tabs)/community' },
  { capabilityKey: 'entry.map', title: 'Mapa', detail: 'Mapa compartido de Palta', target: '/map' },
  { capabilityKey: 'entry.health', title: 'Salud', detail: 'Salud, atención y seguimiento' },
  { capabilityKey: 'entry.pets', title: 'Mascotas', detail: 'Vida, cuidados y trámites de tus mascotas' },
  { capabilityKey: 'entry.education', title: 'Colegio y educación', detail: 'Colegio, cursos y vida escolar' },
  { capabilityKey: 'entry.marketplace', title: 'Mercado', detail: 'Compra y venta local', target: '/(tabs)/market' },
  { capabilityKey: 'entry.jobs', title: 'Trabajos', detail: 'Empleos y trabajos cercanos' },
  { capabilityKey: 'entry.food', title: 'Alimentos', detail: 'Temporada, precios y comida disponible' },
  { capabilityKey: 'entry.events', title: 'Panoramas', detail: 'Eventos, cultura y actividades', target: '/(tabs)/play' },
  { capabilityKey: 'entry.exchange', title: 'Cambio y UF', detail: 'Tipo de cambio, UF e historial' },
  { capabilityKey: 'entry.interests', title: 'Mis intereses', detail: 'Ajustar lo que Palta prioriza para ti' },
  { capabilityKey: 'entry.kids', title: 'Con niños', detail: 'Contenido y panoramas para familias' },
  { capabilityKey: 'entry.services', title: 'Servicios', detail: 'Solicitudes, cotizaciones y ayuda práctica' },
  { capabilityKey: 'entry.notices', title: 'Avisos de Palta', detail: 'Avisos públicos de operación y servicio' },
  { capabilityKey: 'entry.more', title: 'Ver todo', detail: 'Todas las áreas y funciones de Palta' },
] as const;
