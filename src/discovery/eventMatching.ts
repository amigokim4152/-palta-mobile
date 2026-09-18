import type { CanonicalEvent } from './canonicalDiscovery.js';

export type EventMatchContext = Readonly<{
  leftVenueKey?: string;
  rightVenueKey?: string;
  leftOrganizerNames?: readonly string[];
  rightOrganizerNames?: readonly string[];
}>;

export type EventMatchDecision = 'same_event' | 'needs_review' | 'different_event';

export type EventMatchResult = Readonly<{
  decision: EventMatchDecision;
  score: number;
  reasons: readonly string[];
}>;

function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('es-CL')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(normalize(value).split(' ').filter((token) => token.length > 1));
}

function overlapScore(left: readonly string[], right: readonly string[]): number {
  const a = new Set(left.flatMap((value) => [...tokens(value)]));
  const b = new Set(right.flatMap((value) => [...tokens(value)]));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((value) => b.has(value)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function titleScore(left: string, right: string): number {
  const a = normalize(left);
  const b = normalize(right);
  if (a === b) return 1;
  return overlapScore([a], [b]);
}

function parseMs(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timeScore(left: string, right: string): number {
  const a = parseMs(left);
  const b = parseMs(right);
  if (a === null || b === null) return 0;
  const deltaMinutes = Math.abs(a - b) / 60_000;
  if (deltaMinutes <= 5) return 1;
  if (deltaMinutes <= 15) return 0.75;
  if (deltaMinutes <= 30) return 0.4;
  return 0;
}

function sameOptionalKey(left?: string, right?: string): number | null {
  if (!left || !right) return null;
  return normalize(left) === normalize(right) ? 1 : 0;
}

/**
 * Conservative source-record matcher used before assigning a canonical event id.
 * It intentionally requires strong venue/time/title agreement for auto-match;
 * ambiguous records go to verification instead of silently merging.
 */
export function matchCanonicalEvents(
  left: CanonicalEvent,
  right: CanonicalEvent,
  context: EventMatchContext = {},
): EventMatchResult {
  const reasons: string[] = [];
  const title = titleScore(left.title, right.title);
  const time = timeScore(left.startAt, right.startAt);
  const venue = sameOptionalKey(context.leftVenueKey ?? left.venueId, context.rightVenueKey ?? right.venueId);
  const organizer = overlapScore(context.leftOrganizerNames ?? left.organizerIds, context.rightOrganizerNames ?? right.organizerIds);
  const performer = overlapScore(left.performerNames ?? [], right.performerNames ?? []);

  if (title >= 0.9) reasons.push('title_strong');
  else if (title >= 0.65) reasons.push('title_similar');
  if (time === 1) reasons.push('time_close');
  else if (time > 0) reasons.push('time_near');
  if (venue === 1) reasons.push('venue_same');
  if (organizer >= 0.5) reasons.push('organizer_overlap');
  if (performer >= 0.5) reasons.push('performer_overlap');

  // Weighted toward title, venue and exact scheduled time. Organizer/performer
  // improve confidence but cannot rescue a conflicting venue/time combination.
  const venueContribution = venue === null ? 0.12 : venue * 0.24;
  const score = Math.min(1,
    title * 0.34
    + time * 0.28
    + venueContribution
    + Math.min(organizer, 1) * 0.08
    + Math.min(performer, 1) * 0.06,
  );

  const hardVenueConflict = venue === 0;
  const hardTimeConflict = time === 0;
  const strongCore = title >= 0.85 && time >= 0.75 && venue !== 0;

  if (strongCore && score >= 0.78) {
    return { decision: 'same_event', score, reasons };
  }
  if (!hardVenueConflict && !hardTimeConflict && title >= 0.6 && score >= 0.55) {
    return { decision: 'needs_review', score, reasons };
  }
  return { decision: 'different_event', score, reasons };
}
