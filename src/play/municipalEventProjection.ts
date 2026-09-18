import type { PlayDiscoveryItem, PlayThemeKey } from './playDiscovery.js';

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
  audience?: string;
  category?: string;
  imageUrl?: string;
  sourceName: string;
  sourceUrl?: string;
  verifiedAt?: string;
  outdoor?: boolean;
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
  return [
    'famil',
    'niñ',
    'infantil',
    'kids',
    'taller',
    'cuentacuentos',
    'circo',
  ].some((token) => haystack.includes(token));
}

function isOutdoor(input: MunicipalEventPlayInput): boolean {
  if (input.outdoor !== undefined) return input.outdoor;
  const haystack = `${normalize(input.category)} ${normalize(input.title)} ${normalize(input.venue)}`;
  return [
    'aire libre',
    'parque',
    'plaza',
    'feria',
    'ciclet',
    'trekking',
    'sender',
    'outdoor',
  ].some((token) => haystack.includes(token));
}

function inferThemeTags(
  input: MunicipalEventPlayInput,
  context: MunicipalPlayProjectionContext,
): PlayThemeKey[] {
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
  const categoryLabels: ReadonlyArray<[string, string]> = [
    ['music', 'Música'],
    ['música', 'Música'],
    ['culture', 'Cultura'],
    ['cultura', 'Cultura'],
    ['festival', 'Festival'],
    ['exhibition', 'Exposición'],
    ['exposición', 'Exposición'],
    ['cinema', 'Cine'],
    ['cine', 'Cine'],
    ['sports', 'Deporte'],
    ['deporte', 'Deporte'],
    ['workshop', 'Taller'],
    ['taller', 'Taller'],
    ['market', 'Feria'],
    ['feria', 'Feria'],
  ];

  const matched = categoryLabels.find(([key]) => category.includes(key));
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

/**
 * Adapter from normalized municipal/public event data into the Play discovery model.
 * Upstream retains event truth; Play adds only bounded discovery classification.
 */
export function projectMunicipalEventToPlay(
  input: MunicipalEventPlayInput,
  context: MunicipalPlayProjectionContext,
): PlayDiscoveryItem {
  const tags = experienceTags(input);
  return {
    id: `municipal:${input.id}`,
    sourceKind: 'municipal_event',
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
    ...(tags.length ? { experienceTags: tags } : {}),
    themeTags: inferThemeTags(input, context),
    source: {
      authority: input.sourceName,
      ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}),
      ...(input.verifiedAt ? { verifiedAt: input.verifiedAt } : {}),
    },
  };
}

export function projectMunicipalEventsToPlay(
  inputs: readonly MunicipalEventPlayInput[],
  context: MunicipalPlayProjectionContext,
): PlayDiscoveryItem[] {
  return inputs.map((input) => projectMunicipalEventToPlay(input, context));
}
