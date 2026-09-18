import type {
  PlayDiscoveryAction,
  PlayDiscoveryItem,
  PlayThemeKey,
} from './playDiscovery.js';
import { inferPlayContentKind } from './playContentTaxonomy.js';

export type MunicipalEventPlayInput = Readonly<{
  id: string;
  title: string;
  comuna: string;
  venue?: string;
  startDate: string;
  startTime?: string;
  endDate?: string;
  isFree?: boolean;
  requiresRegistration?: boolean;
  registrationUrl?: string;
  ticketUrl?: string;
  reservationUrl?: string;
  audience?: string;
  category?: string;
  imageUrl?: string;
  sourceName: string;
  sourceUrl?: string;
  verifiedAt?: string;
  outdoor?: boolean;
  /** Resolved by shared location/map infrastructure; Play does not calculate it. */
  distanceM?: number;
  distanceLabel?: string;
}>;

export type MunicipalPlayProjectionContext = Readonly<{
  todayIsoDate: string;
  weekendIsoDates: readonly string[];
}>;

function normalize(value?: string): string {
  return (value ?? '').trim().toLocaleLowerCase('es-CL');
}

function activeOnDate(input: MunicipalEventPlayInput, isoDate: string): boolean {
  const endDate = input.endDate ?? input.startDate;
  return input.startDate <= isoDate && isoDate <= endDate;
}

function isFamilyFriendly(input: MunicipalEventPlayInput): boolean {
  const haystack = `${normalize(input.audience)} ${normalize(input.category)} ${normalize(input.title)}`;
  return ['famil', 'niñ', 'infantil', 'kids', 'taller', 'cuentacuentos', 'circo'].some((token) => haystack.includes(token));
}

function isOutdoor(input: MunicipalEventPlayInput): boolean {
  if (input.outdoor !== undefined) return input.outdoor;
  const haystack = `${normalize(input.category)} ${normalize(input.title)} ${normalize(input.venue)}`;
  return ['aire libre', 'parque', 'plaza', 'feria', 'ciclet', 'trekking', 'sender', 'outdoor'].some((token) => haystack.includes(token));
}

function inferThemeTags(input: MunicipalEventPlayInput, context: MunicipalPlayProjectionContext): PlayThemeKey[] {
  const tags: PlayThemeKey[] = [];
  if (activeOnDate(input, context.todayIsoDate)) tags.push('today');
  if (context.weekendIsoDates.some((date) => activeOnDate(input, date))) tags.push('weekend');
  if (input.isFree) tags.push('free');
  if (isOutdoor(input)) tags.push('outdoor');
  if (isFamilyFriendly(input)) tags.push('family');
  return [...new Set(tags)];
}

function experienceTags(input: MunicipalEventPlayInput): string[] {
  const tags: string[] = [];
  const category = normalize(input.category);
  const labels: ReadonlyArray<[string, string]> = [
    ['music', 'Música'], ['música', 'Música'], ['culture', 'Cultura'], ['cultura', 'Cultura'],
    ['festival', 'Festival'], ['exhibition', 'Exposición'], ['exposición', 'Exposición'],
    ['cinema', 'Cine'], ['cine', 'Cine'], ['sports', 'Deporte'], ['deporte', 'Deporte'],
    ['workshop', 'Taller'], ['taller', 'Taller'], ['market', 'Feria'], ['feria', 'Feria'],
  ];
  const matched = labels.find(([key]) => category.includes(key));
  if (matched) tags.push(matched[1]);
  if (isFamilyFriendly(input)) tags.push('Familia');
  if (isOutdoor(input)) tags.push('Aire libre');
  if (input.isFree) tags.push('Gratis');
  return [...new Set(tags)].slice(0, 3);
}

function scheduleLabel(input: MunicipalEventPlayInput, context: MunicipalPlayProjectionContext): string {
  const isToday = activeOnDate(input, context.todayIsoDate);
  const isWeekend = context.weekendIsoDates.some((date) => activeOnDate(input, date));
  const prefix = isToday ? 'Hoy' : isWeekend ? 'Este finde' : input.startDate;
  return input.startTime ? `${prefix} · ${input.startTime}` : prefix;
}

function primaryAction(input: MunicipalEventPlayInput): PlayDiscoveryAction | undefined {
  if (input.requiresRegistration && input.registrationUrl) {
    return { kind: 'registration', url: input.registrationUrl, label: 'Inscribirme' };
  }
  if (input.ticketUrl) {
    return { kind: 'ticket', url: input.ticketUrl, label: 'Ver entradas' };
  }
  if (input.reservationUrl) {
    return { kind: 'reservation', url: input.reservationUrl, label: 'Reservar' };
  }
  return undefined;
}

export function projectMunicipalEventToPlay(input: MunicipalEventPlayInput, context: MunicipalPlayProjectionContext): PlayDiscoveryItem {
  const tags = experienceTags(input);
  const action = primaryAction(input);
  return {
    id: `municipal:${input.id}`,
    sourceKind: 'municipal_event',
    contentKind: inferPlayContentKind({
      category: input.category,
      title: input.title,
      venue: input.venue,
      tags,
    }),
    title: input.title,
    comuna: input.comuna,
    ...(input.venue ? { venue: input.venue } : {}),
    scheduleLabel: scheduleLabel(input, context),
    startAt: input.startTime ? `${input.startDate}T${input.startTime}` : input.startDate,
    ...(input.endDate ? { endAt: input.endDate } : {}),
    isFree: Boolean(input.isFree),
    registrationRequired: Boolean(input.requiresRegistration),
    ...(input.audience ? { audienceLabel: input.audience } : {}),
    ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    ...(input.distanceM !== undefined ? { distanceM: input.distanceM } : {}),
    ...(input.distanceLabel ? { distanceLabel: input.distanceLabel } : {}),
    ...(tags.length ? { experienceTags: tags } : {}),
    ...(action ? { primaryAction: action } : {}),
    themeTags: inferThemeTags(input, context),
    source: {
      authority: input.sourceName,
      ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
      ...(input.verifiedAt ? { verifiedAt: input.verifiedAt } : {}),
    },
  };
}

export function projectMunicipalEventsToPlay(inputs: readonly MunicipalEventPlayInput[], context: MunicipalPlayProjectionContext): PlayDiscoveryItem[] {
  return inputs.map((input) => projectMunicipalEventToPlay(input, context));
}
