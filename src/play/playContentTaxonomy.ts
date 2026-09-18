import type { PlayThemeKey } from './playDiscovery.js';

/**
 * What the user can actually do in Play.
 *
 * Keep this separate from source/provenance. A movie can come from a cinema,
 * ticket partner or municipal screening; it is still a `movie` for discovery.
 */
export const playContentKinds = [
  'movie',
  'live_performance',
  'concert',
  'theater',
  'comedy',
  'exhibition',
  'museum',
  'festival',
  'fair_market',
  'sports_event',
  'family_activity',
  'birthday',
  'water_activity',
  'active_leisure',
  'workshop',
  'attraction',
  'park',
  'nature',
  'farm',
  'food_outing',
  'day_trip',
  'tour',
  'stay',
  'other',
] as const;

export type PlayContentKind = (typeof playContentKinds)[number];

export type PlayContentFamily =
  | 'culture_entertainment'
  | 'family_kids'
  | 'outdoor_nature'
  | 'sports_active'
  | 'food_social'
  | 'travel_escape';

export type PlayContentDefinition = Readonly<{
  kind: PlayContentKind;
  family: PlayContentFamily;
  labelEs: string;
  defaultThemes: readonly PlayThemeKey[];
}>;

export const playContentDefinitions: readonly PlayContentDefinition[] = [
  { kind: 'movie', family: 'culture_entertainment', labelEs: 'Cine', defaultThemes: [] },
  { kind: 'live_performance', family: 'culture_entertainment', labelEs: 'Espectáculos', defaultThemes: [] },
  { kind: 'concert', family: 'culture_entertainment', labelEs: 'Conciertos', defaultThemes: [] },
  { kind: 'theater', family: 'culture_entertainment', labelEs: 'Teatro', defaultThemes: [] },
  { kind: 'comedy', family: 'culture_entertainment', labelEs: 'Comedia', defaultThemes: [] },
  { kind: 'exhibition', family: 'culture_entertainment', labelEs: 'Exposiciones', defaultThemes: [] },
  { kind: 'museum', family: 'culture_entertainment', labelEs: 'Museos', defaultThemes: ['family'] },
  { kind: 'festival', family: 'culture_entertainment', labelEs: 'Festivales', defaultThemes: [] },
  { kind: 'fair_market', family: 'culture_entertainment', labelEs: 'Ferias', defaultThemes: ['outdoor'] },
  { kind: 'sports_event', family: 'sports_active', labelEs: 'Deportes', defaultThemes: [] },
  { kind: 'family_activity', family: 'family_kids', labelEs: 'Con niños', defaultThemes: ['family'] },
  { kind: 'birthday', family: 'family_kids', labelEs: 'Cumpleaños', defaultThemes: ['birthday', 'family'] },
  { kind: 'water_activity', family: 'sports_active', labelEs: 'Piscina y agua', defaultThemes: ['outdoor'] },
  { kind: 'active_leisure', family: 'sports_active', labelEs: 'Actividades', defaultThemes: [] },
  { kind: 'workshop', family: 'family_kids', labelEs: 'Talleres', defaultThemes: [] },
  { kind: 'attraction', family: 'family_kids', labelEs: 'Atracciones', defaultThemes: ['family'] },
  { kind: 'park', family: 'outdoor_nature', labelEs: 'Parques', defaultThemes: ['outdoor', 'family'] },
  { kind: 'nature', family: 'outdoor_nature', labelEs: 'Naturaleza', defaultThemes: ['outdoor'] },
  { kind: 'farm', family: 'outdoor_nature', labelEs: 'Granjas', defaultThemes: ['outdoor', 'family'] },
  { kind: 'food_outing', family: 'food_social', labelEs: 'Comer y tomar algo', defaultThemes: [] },
  { kind: 'day_trip', family: 'travel_escape', labelEs: 'Escapadas', defaultThemes: [] },
  { kind: 'tour', family: 'travel_escape', labelEs: 'Tours', defaultThemes: [] },
  { kind: 'stay', family: 'travel_escape', labelEs: 'Estadías', defaultThemes: [] },
  { kind: 'other', family: 'culture_entertainment', labelEs: 'Otros panoramas', defaultThemes: [] },
] as const;

const definitionByKind = new Map<PlayContentKind, PlayContentDefinition>(
  playContentDefinitions.map((definition) => [definition.kind, definition]),
);

export function playContentDefinition(kind: PlayContentKind): PlayContentDefinition {
  return definitionByKind.get(kind) ?? {
    kind: 'other',
    family: 'culture_entertainment',
    labelEs: 'Otros panoramas',
    defaultThemes: [],
  };
}

function normalize(value?: string): string {
  return (value ?? '')
    .trim()
    .toLocaleLowerCase('es-CL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Conservative classifier for sources that do not yet provide canonical kinds.
 * Upstream explicit kinds always win; this only prevents source-specific category
 * vocabularies from leaking into the UI contract.
 */
export function inferPlayContentKind(input: {
  category?: string;
  title?: string;
  venue?: string;
  tags?: readonly string[];
}): PlayContentKind {
  const text = normalize(
    [input.category, input.title, input.venue, ...(input.tags ?? [])]
      .filter(Boolean)
      .join(' '),
  );

  const rules: ReadonlyArray<readonly [PlayContentKind, readonly string[]]> = [
    ['birthday', ['cumpleanos', 'birthday']],
    ['movie', ['cine', 'cinema', 'pelicula', 'film']],
    ['concert', ['concierto', 'recital', 'musica en vivo']],
    ['theater', ['teatro', 'obra teatral']],
    ['comedy', ['comedia', 'stand up', 'stand-up']],
    ['exhibition', ['exposicion', 'galeria', 'arte visual']],
    ['museum', ['museo']],
    ['festival', ['festival', 'carnaval']],
    ['fair_market', ['feria', 'mercado', 'market']],
    ['sports_event', ['partido', 'campeonato', 'torneo', 'deporte', 'sports']],
    ['water_activity', ['piscina', 'acuatico', 'waterpark', 'spa', 'natacion']],
    ['farm', ['granja', 'animales de granja']],
    ['park', ['parque', 'plaza']],
    ['nature', ['trekking', 'sendero', 'naturaleza', 'cerro']],
    ['workshop', ['taller', 'workshop', 'ceramica', 'pintura']],
    ['active_leisure', ['karting', 'laser tag', 'trampolin', 'bowling', 'escalada', 'skate']],
    ['attraction', ['parque de diversiones', 'zoologico', 'zoo', 'acuario', 'atraccion']],
    ['family_activity', ['infantil', 'ninos', 'familia', 'cuentacuentos']],
    ['food_outing', ['restaurante', 'restaurant', 'cafeteria', 'cafe', 'gastronomia']],
    ['stay', ['hotel', 'hostal', 'cabana', 'alojamiento', 'camping']],
    ['tour', ['tour', 'visita guiada', 'excursion']],
    ['day_trip', ['escapada', 'paseo por el dia', 'day trip']],
    ['live_performance', ['espectaculo', 'show', 'circo', 'danza', 'ballet']],
  ];

  for (const [kind, tokens] of rules) {
    if (tokens.some((token) => text.includes(token))) return kind;
  }
  return 'other';
}
