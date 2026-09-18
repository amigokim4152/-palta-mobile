import type { LocationPoint } from '../location/locationCore.js';

export type DiscoveryVerificationStatus =
  | 'verified'
  | 'corroborated'
  | 'needs_verification'
  | 'stale'
  | 'conflict'
  | 'rejected'
  | 'expired';

export type DiscoveryAudienceContext = 'family' | 'couple' | 'solo' | 'group' | 'adult' | 'teen';

export type VenueType =
  | 'theatre_small'
  | 'theatre'
  | 'performing_arts'
  | 'live_music'
  | 'jazz_blues'
  | 'classical_music'
  | 'club_dj'
  | 'comedy'
  | 'dance_performance'
  | 'cinema_independent'
  | 'gallery_exhibition'
  | 'cultural_center'
  | 'family_show'
  | 'festival_ground'
  | 'outdoor_cultural'
  | 'municipal_cultural'
  | 'museum'
  | 'park'
  | 'activity_center'
  | 'birthday_venue'
  | 'sports_venue'
  | 'restaurant_bar'
  | 'other';

export type Venue = Readonly<{
  venueId: string;
  canonicalBusinessId?: string;
  canonicalPlaceId?: string;
  name: string;
  venueType: VenueType;
  categoryIds: readonly string[];
  comuna: string;
  /** Only owned here when no canonical Business/Place location owns the fact. */
  addressLabel?: string;
  location?: LocationPoint;
  phone?: string;
  whatsapp?: string;
  website?: string;
  socialUrls?: readonly string[];
  openingHoursRef?: string;
  capacity?: number;
  setting?: 'indoor' | 'outdoor' | 'mixed';
  accessibilityTags?: readonly string[];
  familyFriendly?: boolean;
  ageMin?: number;
  priceLevel?: 0 | 1 | 2 | 3 | 4;
  verificationStatus: DiscoveryVerificationStatus;
  lastVerifiedAt?: string;
}>;

export type OrganizerKind =
  | 'venue'
  | 'producer'
  | 'municipality'
  | 'public_institution'
  | 'foundation'
  | 'cultural_organization'
  | 'artist_collective'
  | 'festival_operator'
  | 'other';

export type Organizer = Readonly<{
  organizerId: string;
  canonicalBusinessId?: string;
  name: string;
  kind: OrganizerKind;
  website?: string;
  socialUrls?: readonly string[];
  verificationStatus: DiscoveryVerificationStatus;
  lastVerifiedAt?: string;
}>;

export type DiscoveryPrice = Readonly<{
  free: boolean;
  fromMinor?: number;
  toMinor?: number;
  currency?: string;
}>;

export type EventRecurrence = Readonly<{
  kind: 'none' | 'series' | 'recurring';
  seriesId?: string;
  rule?: string;
}>;

export type CanonicalEvent = Readonly<{
  eventId: string;
  canonicalKey?: string;
  venueId?: string;
  organizerIds: readonly string[];
  title: string;
  description?: string;
  eventType: string;
  genres: readonly string[];
  performerNames?: readonly string[];
  startAt: string;
  endAt?: string;
  recurrence?: EventRecurrence;
  price: DiscoveryPrice;
  ageMin?: number;
  familyFriendly?: boolean;
  audienceContexts?: readonly DiscoveryAudienceContext[];
  bookingRequired?: boolean;
  imageUrl?: string;
  sourceEvidenceIds: readonly string[];
  verificationStatus: DiscoveryVerificationStatus;
  publishedAt?: string;
  expiresAt?: string;
  updatedAt?: string;
}>;

export type OfferingAvailability = Readonly<{
  mode: 'always' | 'opening_hours' | 'date_range' | 'schedule' | 'on_request';
  validFrom?: string;
  validTo?: string;
  scheduleRef?: string;
}>;

export type CanonicalOffering = Readonly<{
  offeringId: string;
  canonicalBusinessId?: string;
  venueId?: string;
  title: string;
  description?: string;
  offeringType: string;
  categoryIds: readonly string[];
  availability: OfferingAvailability;
  price?: DiscoveryPrice;
  capacity?: number;
  durationMinutes?: number;
  ageMin?: number;
  familyFriendly?: boolean;
  audienceContexts?: readonly DiscoveryAudienceContext[];
  bookingRequired?: boolean;
  bookingUrl?: string;
  imageUrl?: string;
  sourceEvidenceIds: readonly string[];
  verificationStatus: DiscoveryVerificationStatus;
  lastVerifiedAt?: string;
}>;

export type SourceEvidence = Readonly<{
  evidenceId: string;
  sourceId: string;
  entityType: 'venue' | 'organizer' | 'event' | 'offering';
  entityId: string;
  sourceUrl?: string;
  sourceRecordId?: string;
  observedAt: string;
  sourceUpdatedAt?: string;
  fieldsObserved?: readonly string[];
  status: 'supporting' | 'conflicting' | 'superseded' | 'rejected';
}>;

function nonEmpty(value?: string): boolean {
  return Boolean(value?.trim());
}

function validLocation(point?: LocationPoint): boolean {
  if (!point) return true;
  return Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90
    && Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180;
}

export function validateVenue(venue: Venue): readonly string[] {
  const issues: string[] = [];
  if (!nonEmpty(venue.venueId)) issues.push('venue_id_required');
  if (!nonEmpty(venue.name)) issues.push('venue_name_required');
  if (!nonEmpty(venue.comuna)) issues.push('venue_comuna_required');
  if (!validLocation(venue.location)) issues.push('venue_location_invalid');
  if (venue.capacity !== undefined && (!Number.isInteger(venue.capacity) || venue.capacity < 0)) issues.push('venue_capacity_invalid');
  if (venue.ageMin !== undefined && (!Number.isInteger(venue.ageMin) || venue.ageMin < 0)) issues.push('venue_age_min_invalid');
  return [...new Set(issues)];
}

export function validateCanonicalEvent(event: CanonicalEvent): readonly string[] {
  const issues: string[] = [];
  if (!nonEmpty(event.eventId)) issues.push('event_id_required');
  if (!nonEmpty(event.title)) issues.push('event_title_required');
  if (!nonEmpty(event.startAt)) issues.push('event_start_required');
  if (event.endAt && event.endAt < event.startAt) issues.push('event_time_range_invalid');
  if (!event.price.free && event.price.fromMinor !== undefined && event.price.fromMinor < 0) issues.push('event_price_invalid');
  if (event.price.toMinor !== undefined && event.price.fromMinor !== undefined && event.price.toMinor < event.price.fromMinor) issues.push('event_price_range_invalid');
  return [...new Set(issues)];
}

export function validateCanonicalOffering(offering: CanonicalOffering): readonly string[] {
  const issues: string[] = [];
  if (!nonEmpty(offering.offeringId)) issues.push('offering_id_required');
  if (!nonEmpty(offering.title)) issues.push('offering_title_required');
  if (!offering.canonicalBusinessId && !offering.venueId) issues.push('offering_owner_required');
  if (offering.durationMinutes !== undefined && (!Number.isFinite(offering.durationMinutes) || offering.durationMinutes <= 0)) issues.push('offering_duration_invalid');
  return [...new Set(issues)];
}

/** Hide ended/expired events from live discovery without deleting analytical history. */
export function canonicalEventIsDiscoverable(event: CanonicalEvent, nowIso: string): boolean {
  if (['rejected', 'expired', 'stale', 'conflict'].includes(event.verificationStatus)) return false;
  if (event.expiresAt && event.expiresAt < nowIso) return false;
  const temporalEnd = event.endAt ?? event.startAt;
  return temporalEnd >= nowIso;
}
