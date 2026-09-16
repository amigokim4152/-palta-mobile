import type { LocationContext, LocationRef } from '../core/contracts.js';

export type LocationIntent = 'current' | 'home' | 'work' | 'saved' | 'explore';

export function setExploringLocation(
  context: LocationContext,
  location: LocationRef,
): LocationContext {
  return { ...context, exploringLocation: location };
}

export function confirmLifeArea(
  context: LocationContext,
  intent: Exclude<LocationIntent, 'current' | 'explore'>,
  location: LocationRef,
): LocationContext {
  if (intent === 'home') return { ...context, homeArea: location };
  if (intent === 'work') return { ...context, workArea: location };
  if (intent === 'saved') {
    const exists = context.savedPlaces.some((item) => item.id === location.id);
    return exists ? context : { ...context, savedPlaces: [...context.savedPlaces, location] };
  }
  return context;
}

/** Persisted life areas may drive durable personalization and future care. */
export function isConfirmedLifeArea(
  location: LocationRef,
  context: LocationContext,
): boolean {
  return (
    context.homeArea?.id === location.id ||
    context.workArea?.id === location.id ||
    context.savedPlaces.some((item) => item.id === location.id)
  );
}

/**
 * Current GPS can affect ephemeral "right now" context such as nearby transit/weather,
 * without silently becoming a durable life fact.
 */
export function canAffectImmediateContext(
  location: LocationRef,
  context: LocationContext,
): boolean {
  return context.currentLocation?.id === location.id || isConfirmedLifeArea(location, context);
}

// Merely searching/browsing a place never promotes it into the user's life graph.
export function explorationIsLifeFact(): false {
  return false;
}
