export type LocationPermission =
  | 'unknown'
  | 'granted_foreground'
  | 'denied'
  | 'restricted';

export type LocationSource =
  | 'device_current'
  | 'home_area'
  | 'work_area'
  | 'saved_place'
  | 'exploring';

export type LocationPoint = {
  latitude: number;
  longitude: number;
  accuracyM?: number;
};

export type EffectiveLocation = {
  source: LocationSource;
  point: LocationPoint;
  observedAt?: string;
  label?: string;
};

export type LocationCoreState = {
  permission: LocationPermission;
  current: EffectiveLocation | null;
  homeArea: EffectiveLocation | null;
  workArea: EffectiveLocation | null;
  exploring: EffectiveLocation | null;
};

export function initialLocationCoreState(): LocationCoreState {
  return {
    permission: 'unknown',
    current: null,
    homeArea: null,
    workArea: null,
    exploring: null,
  };
}

export function setLocationPermission(
  state: LocationCoreState,
  permission: LocationPermission,
): LocationCoreState {
  return { ...state, permission };
}

export function observeCurrentLocation(
  state: LocationCoreState,
  point: LocationPoint,
  observedAt: string,
): LocationCoreState {
  return {
    ...state,
    current: {
      source: 'device_current',
      point,
      observedAt,
    },
  };
}

export function setExploringLocation(
  state: LocationCoreState,
  point: LocationPoint,
  label?: string,
): LocationCoreState {
  return {
    ...state,
    exploring: {
      source: 'exploring',
      point,
      ...(label ? { label } : {}),
    },
  };
}

export function clearExploringLocation(
  state: LocationCoreState,
): LocationCoreState {
  return { ...state, exploring: null };
}

export function setConfirmedHomeArea(
  state: LocationCoreState,
  point: LocationPoint,
  label?: string,
): LocationCoreState {
  return {
    ...state,
    homeArea: {
      source: 'home_area',
      point,
      ...(label ? { label } : {}),
    },
  };
}

export function resolveNeighborhoodLocation(
  state: LocationCoreState,
): EffectiveLocation | null {
  return (
    state.exploring ??
    state.current ??
    state.homeArea ??
    state.workArea ??
    null
  );
}

export function canPromoteToLifeArea(location: EffectiveLocation): boolean {
  return (
    location.source === 'home_area' ||
    location.source === 'work_area' ||
    location.source === 'saved_place'
  );
}
