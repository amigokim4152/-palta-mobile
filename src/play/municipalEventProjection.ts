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

function inferThemeTags(
  input: MunicipalEventPlayInput,
  context: MunicipalPlayProjectionContext,
): PlayThemeKey[] {
  const tags: PlayThemeKey[] = [];
  if (input.startDate === context.todayIsoDate) tags.push('today');
  if (context.weekendIsoDates.includes(input.startDate)) tags.push('weekend');
  if (input.isFree) tags.push('free');
  if (input.outdoor) tags.push('outdoor');
  if (isFamilyFriendly(input)) tags.push('family');
  return [...new Set(tags)];
}

function scheduleLabel(input: MunicipalEventPlayInput, context: MunicipalPlayProjectionContext): string {
  const prefix = input.startDate === context.todayIsoDate
    ? 'Hoy'
    : context.weekendIsoDates.includes(input.startDate)
      ? 'Este finde'
      : input.startDate;
  return input.startTime ? `${prefix} · ${input.startTime}` : prefix;
}

/**
 * Adapter from canonical municipal/public event data into the Play discovery model.
 * The municipality remains the source authority; Play only changes presentation and
 * intent grouping. No event ownership is copied into Play.
 */
export function projectMunicipalEventToPlay(
  input: MunicipalEventPlayInput,
  context: MunicipalPlayProjectionContext,
): PlayDiscoveryItem {
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
