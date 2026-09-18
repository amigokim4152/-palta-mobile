import type { PaltaEvent } from '../events/eventBusPort.js';
import type { PlayDiscoveryItem } from './playDiscovery.js';

export type PanoramaNotificationReason =
  | 'saved_starting_soon'
  | 'nearby_today'
  | 'weekend_interest';

export type PanoramaNotificationCandidatePayload = Readonly<{
  surface: 'panorama';
  discoveryItemId: string;
  reason: PanoramaNotificationReason;
  title: string;
  comuna: string;
  startAt?: string;
  eventId?: string;
  venueId?: string;
  isFree?: boolean;
}>;

/**
 * Event Core handoff for Panorama notification evaluation.
 *
 * This deliberately carries no coordinates, device identifiers or commercial
 * deal terms. Notification Core decides whether the candidate merits delivery.
 */
export function buildPanoramaNotificationCandidate(input: {
  item: PlayDiscoveryItem;
  reason: PanoramaNotificationReason;
  occurredAt: string;
}): PaltaEvent<PanoramaNotificationCandidatePayload> {
  const { item, reason, occurredAt } = input;
  return {
    id: `panorama-notification:${reason}:${item.id}:${occurredAt}`,
    type: 'notification.candidate',
    occurredAt,
    source: 'panorama',
    subjectRef: `panorama:${item.id}`,
    dedupeKey: `panorama:${reason}:${item.id}:${item.startAt ?? item.scheduleLabel}`,
    payload: {
      surface: 'panorama',
      discoveryItemId: item.id,
      reason,
      title: item.title,
      comuna: item.comuna,
      ...(item.startAt ? { startAt: item.startAt } : {}),
      ...(item.eventId ? { eventId: item.eventId } : {}),
      ...(item.venueId ? { venueId: item.venueId } : {}),
      ...(item.isFree !== undefined ? { isFree: item.isFree } : {}),
    },
  };
}
