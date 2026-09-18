import type {
  CanonicalEvent,
  CanonicalOffering,
  SourceEvidence,
  Venue,
} from '../discovery/canonicalDiscovery.js';
import { canonicalEventIsDiscoverable } from '../discovery/canonicalDiscovery.js';
import type { DiscoveryDataSource } from '../discovery/dataSourceRegistry.js';
import type { PlayDiscoveryItem, PlayThemeKey } from './playDiscovery.js';
import { inferPlayContentKind } from './playContentTaxonomy.js';

export type CanonicalPlayProjectionContext = Readonly<{
  nowIso: string;
  todayIsoDate: string;
  weekendIsoDates: readonly string[];
  distanceByVenueId?: Readonly<Record<string, number>>;
  distanceLabelByVenueId?: Readonly<Record<string, string>>;
  travelTimeMinutesByVenueId?: Readonly<Record<string, number>>;
}>;

export type CanonicalDiscoveryCatalog = Readonly<{
  venues: readonly Venue[];
  events: readonly CanonicalEvent[];
  offerings: readonly CanonicalOffering[];
  sourceEvidence: readonly SourceEvidence[];
  sources: readonly DiscoveryDataSource[];
}>;

function sourceForEntity(
  evidenceIds: readonly string[],
  evidence: readonly SourceEvidence[],
  sources: readonly DiscoveryDataSource[],
): { authority: string; sourceUrl?: string; verifiedAt?: string } {
  const evidenceById = new Map(evidence.map((item) => [item.evidenceId, item]));
  const sourceById = new Map(sources.map((item) => [item.sourceId, item]));
  for (const evidenceId of evidenceIds) {
    const item = evidenceById.get(evidenceId);
    if (!item || item.status === 'rejected') continue;
    const source = sourceById.get(item.sourceId);
    if (!source) continue;
    return {
      authority: source.owner,
      ...(item.sourceUrl ?? source.url ? { sourceUrl: item.sourceUrl ?? source.url } : {}),
      ...(item.observedAt ? { verifiedAt: item.observedAt } : {}),
    };
  }
  return { authority: 'Somos Palta' };
}

function datePart(value: string): string {
  return value.slice(0, 10);
}

function eventThemeTags(
  event: CanonicalEvent,
  contentKind: ReturnType<typeof inferPlayContentKind>,
  context: CanonicalPlayProjectionContext,
): PlayThemeKey[] {
  const tags: PlayThemeKey[] = [];
  const startDate = datePart(event.startAt);
  const endDate = datePart(event.endAt ?? event.startAt);
  const includesDate = (date: string) => startDate <= date && date <= endDate;
  if (includesDate(context.todayIsoDate)) tags.push('today');
  if (context.weekendIsoDates.some(includesDate)) tags.push('weekend');
  if (event.price.free) tags.push('free');
  if (event.familyFriendly) tags.push('family');
  if (['festival', 'fair_market', 'park', 'nature', 'water_activity'].includes(contentKind)) tags.push('outdoor');
  return [...new Set(tags)];
}

function offeringThemeTags(
  offering: CanonicalOffering,
  contentKind: ReturnType<typeof inferPlayContentKind>,
): PlayThemeKey[] {
  const tags: PlayThemeKey[] = [];
  if (offering.price?.free) tags.push('free');
  if (offering.familyFriendly) tags.push('family');
  if (contentKind === 'birthday') tags.push('birthday');
  if (['park', 'nature', 'farm', 'water_activity'].includes(contentKind)) tags.push('outdoor');
  return [...new Set(tags)];
}

function priceLabel(price?: CanonicalOffering['price'] | CanonicalEvent['price']): string | undefined {
  if (!price) return undefined;
  if (price.free) return 'Gratis';
  if (price.fromMinor === undefined || !price.currency) return undefined;
  const value = Math.round(price.fromMinor / 100);
  return `Desde ${value.toLocaleString('es-CL')} ${price.currency}`;
}

function scheduleLabel(event: CanonicalEvent, context: CanonicalPlayProjectionContext): string {
  const date = datePart(event.startAt);
  const time = event.startAt.length >= 16 ? event.startAt.slice(11, 16) : '';
  const prefix = date === context.todayIsoDate
    ? 'Hoy'
    : context.weekendIsoDates.includes(date)
      ? 'Este finde'
      : date;
  return time ? `${prefix} · ${time}` : prefix;
}

function distanceFields(venueId: string | undefined, context: CanonicalPlayProjectionContext) {
  if (!venueId) return {};
  const distanceM = context.distanceByVenueId?.[venueId];
  const travelTime = context.travelTimeMinutesByVenueId?.[venueId];
  const distanceLabel = travelTime !== undefined
    ? `${Math.round(travelTime)} min`
    : context.distanceLabelByVenueId?.[venueId];
  return {
    ...(distanceM !== undefined ? { distanceM } : {}),
    ...(distanceLabel ? { distanceLabel } : {}),
  };
}

export function projectCanonicalEventToPlay(input: {
  event: CanonicalEvent;
  venue?: Venue;
  evidence: readonly SourceEvidence[];
  sources: readonly DiscoveryDataSource[];
  context: CanonicalPlayProjectionContext;
}): PlayDiscoveryItem | null {
  const { event, venue, context } = input;
  if (!canonicalEventIsDiscoverable(event, context.nowIso)) return null;
  if (!venue) return null;

  const contentKind = inferPlayContentKind({
    category: event.eventType,
    title: event.title,
    venue: venue.name,
    tags: [...event.genres, ...(event.performerNames ?? [])],
  });

  return {
    id: `event:${event.eventId}`,
    canonicalKey: event.canonicalKey ?? `event:${event.eventId}`,
    sourceKind: venue.canonicalBusinessId ? 'business' : 'public_program',
    contentKind,
    title: event.title,
    comuna: venue.comuna,
    venue: venue.name,
    scheduleLabel: scheduleLabel(event, context),
    startAt: event.startAt,
    ...(event.endAt ? { endAt: event.endAt } : {}),
    isFree: event.price.free,
    bookingRequired: undefined,
    registrationRequired: Boolean(event.bookingRequired),
    ...(event.ageMin !== undefined ? { audienceLabel: event.familyFriendly ? `Familiar · ${event.ageMin}+` : `${event.ageMin}+` } : event.familyFriendly ? { audienceLabel: 'Familiar' } : {}),
    ...(event.imageUrl ? { imageUrl: event.imageUrl } : {}),
    ...(priceLabel(event.price) ? { priceLabel: priceLabel(event.price) } : {}),
    ...distanceFields(event.venueId, context),
    experienceTags: [...new Set([...event.genres, ...(event.familyFriendly ? ['Familia'] : [])])].slice(0, 3),
    themeTags: eventThemeTags(event, contentKind, context),
    ...(venue.canonicalPlaceId ? { placeId: venue.canonicalPlaceId } : {}),
    ...(venue.canonicalBusinessId ? {
      businessId: venue.canonicalBusinessId,
      businessProjection: {
        businessId: venue.canonicalBusinessId,
        exposureReason: `event:${event.eventId}`,
      },
    } : {}),
    source: sourceForEntity(event.sourceEvidenceIds, input.evidence, input.sources),
  } as PlayDiscoveryItem;
}

export function projectCanonicalOfferingToPlay(input: {
  offering: CanonicalOffering;
  venue?: Venue;
  evidence: readonly SourceEvidence[];
  sources: readonly DiscoveryDataSource[];
  context: CanonicalPlayProjectionContext;
}): PlayDiscoveryItem | null {
  const { offering, venue, context } = input;
  if (['rejected', 'expired', 'stale', 'conflict'].includes(offering.verificationStatus)) return null;
  if (!venue && !offering.canonicalBusinessId) return null;
  if (offering.availability.validTo && offering.availability.validTo < context.nowIso) return null;

  const contentKind = inferPlayContentKind({
    category: offering.offeringType,
    title: offering.title,
    venue: venue?.name,
    tags: offering.categoryIds,
  });
  const businessId = offering.canonicalBusinessId ?? venue?.canonicalBusinessId;
  const venueId = offering.venueId ?? venue?.venueId;

  return {
    id: `offering:${offering.offeringId}`,
    canonicalKey: `offering:${offering.offeringId}`,
    sourceKind: businessId ? 'business' : 'place',
    contentKind,
    title: offering.title,
    comuna: venue?.comuna ?? 'Chile',
    ...(venue?.name ? { venue: venue.name } : {}),
    scheduleLabel: offering.availability.mode === 'on_request' ? 'Reserva previa' : 'Consulta disponibilidad',
    isFree: offering.price?.free,
    registrationRequired: Boolean(offering.bookingRequired),
    ...(offering.ageMin !== undefined ? { audienceLabel: offering.familyFriendly ? `Familiar · ${offering.ageMin}+` : `${offering.ageMin}+` } : offering.familyFriendly ? { audienceLabel: 'Familiar' } : {}),
    ...(offering.imageUrl ? { imageUrl: offering.imageUrl } : {}),
    ...(priceLabel(offering.price) ? { priceLabel: priceLabel(offering.price) } : {}),
    ...distanceFields(venueId, context),
    experienceTags: offering.categoryIds.slice(0, 3),
    themeTags: offeringThemeTags(offering, contentKind),
    ...(venue?.canonicalPlaceId ? { placeId: venue.canonicalPlaceId } : {}),
    ...(businessId ? {
      businessId,
      businessProjection: {
        businessId,
        offeringId: offering.offeringId,
        exposureReason: `offering:${offering.offeringType}`,
      },
    } : {}),
    source: sourceForEntity(offering.sourceEvidenceIds, input.evidence, input.sources),
  } as PlayDiscoveryItem;
}

export function projectCanonicalCatalogToPlay(
  catalog: CanonicalDiscoveryCatalog,
  context: CanonicalPlayProjectionContext,
): PlayDiscoveryItem[] {
  const venues = new Map(catalog.venues.map((venue) => [venue.venueId, venue]));
  const events = catalog.events
    .map((event) => projectCanonicalEventToPlay({
      event,
      venue: event.venueId ? venues.get(event.venueId) : undefined,
      evidence: catalog.sourceEvidence,
      sources: catalog.sources,
      context,
    }))
    .filter((item): item is PlayDiscoveryItem => Boolean(item));
  const offerings = catalog.offerings
    .map((offering) => projectCanonicalOfferingToPlay({
      offering,
      venue: offering.venueId ? venues.get(offering.venueId) : undefined,
      evidence: catalog.sourceEvidence,
      sources: catalog.sources,
      context,
    }))
    .filter((item): item is PlayDiscoveryItem => Boolean(item));
  return [...events, ...offerings];
}
