export const PRIMARY_SURFACES = [
  'home',
  'neighborhood',
  'community',
  'market',
  'play',
] as const;

export type PrimarySurface = typeof PRIMARY_SURFACES[number];

export const SURFACE_LABELS: Record<PrimarySurface, { 'es-CL': string; ko: string }> = {
  home: { 'es-CL': 'Inicio', ko: '홈' },
  neighborhood: { 'es-CL': 'Barrio', ko: '동네' },
  community: { 'es-CL': 'Comunidad', ko: '커뮤니티' },
  market: { 'es-CL': 'Mercado', ko: '마켓' },
  play: { 'es-CL': 'Panorama', ko: '놀자' },
};

/** Map is a shared contextual view, not a sixth permanent bottom-tab destination. */
export const MAP_IS_PRIMARY_SURFACE = false as const;

/** Create/post actions belong to their current context, not a permanent bottom tab. */
export const CREATE_IS_PRIMARY_SURFACE = false as const;
