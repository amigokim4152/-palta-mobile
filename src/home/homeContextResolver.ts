import type { LocationContext, LocationRef } from '../core/contracts.js';
import type { CoreProfile } from '../profile/profileModel.js';
import type { HomeContext } from './homeFunctionalContract.js';

export type HomeLocalitySource =
  | 'explicit'
  | 'home_area'
  | 'current_location'
  | 'saved_area'
  | 'unresolved';

export type ResolvedHomeContext = HomeContext & {
  localitySource: HomeLocalitySource;
  profileLabel?: string;
};

function allKnownLocations(context: LocationContext): LocationRef[] {
  return [
    ...(context.homeArea ? [context.homeArea] : []),
    ...(context.currentLocation ? [context.currentLocation] : []),
    ...(context.workArea ? [context.workArea] : []),
    ...context.savedPlaces,
    ...(context.exploringLocation ? [context.exploringLocation] : []),
  ];
}

function findExplicitLocation(
  locations: LocationContext,
  explicitLocalityId: string | undefined,
): LocationRef | undefined {
  if (!explicitLocalityId) return undefined;
  return allKnownLocations(locations).find((item) => item.id === explicitLocalityId);
}

export function resolveHomeContext(input: {
  profile?: Pick<CoreProfile, 'preferredName'>;
  locations: LocationContext;
  explicitLocalityId?: string;
  unreadNotificationCount?: number;
}): ResolvedHomeContext {
  const explicit = findExplicitLocation(input.locations, input.explicitLocalityId);

  let locality: LocationRef | undefined;
  let localitySource: HomeLocalitySource = 'unresolved';

  if (explicit) {
    locality = explicit;
    localitySource = 'explicit';
  } else if (input.locations.homeArea) {
    locality = input.locations.homeArea;
    localitySource = 'home_area';
  } else if (input.locations.currentLocation) {
    locality = input.locations.currentLocation;
    localitySource = 'current_location';
  } else if (input.locations.savedPlaces[0]) {
    locality = input.locations.savedPlaces[0];
    localitySource = 'saved_area';
  }

  const base: ResolvedHomeContext = {
    locality: locality
      ? {
          id: locality.id,
          label: locality.comuna ?? locality.label,
          changeTarget: '/context/location',
        }
      : {
          label: 'Seleccionar zona',
          changeTarget: '/context/location',
        },
    notificationsTarget: '/context/notifications',
    profileTarget: '/context/profile',
    localitySource,
  };

  if (input.unreadNotificationCount !== undefined) {
    base.unreadNotificationCount = Math.max(0, input.unreadNotificationCount);
  }

  const profileLabel = input.profile?.preferredName?.trim();
  if (profileLabel) base.profileLabel = profileLabel;

  return base;
}

/**
 * Current GPS may drive immediate Home relevance, but must not be persisted as
 * a durable home area merely because it became the effective Home locality.
 */
export function homeContextCreatesDurableLocationFact(
  context: ResolvedHomeContext,
): boolean {
  return context.localitySource === 'home_area' || context.localitySource === 'saved_area';
}
