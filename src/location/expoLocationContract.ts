import type { LocationPermission, LocationPoint } from './locationCore.js';

export type ExpoPermissionLike = {
  status: string;
  canAskAgain?: boolean;
};

export type ExpoLocationLike = {
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  };
  timestamp?: number;
};

export function normalizeExpoForegroundPermission(
  permission: ExpoPermissionLike,
): LocationPermission {
  if (permission.status === 'granted') return 'granted_foreground';
  if (permission.status === 'denied' && permission.canAskAgain === false) {
    return 'restricted';
  }
  if (permission.status === 'denied') return 'denied';
  return 'unknown';
}

export function normalizeExpoLocation(
  location: ExpoLocationLike,
): LocationPoint {
  const accuracy = location.coords.accuracy;
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    ...(typeof accuracy === 'number' && Number.isFinite(accuracy)
      ? { accuracyM: accuracy }
      : {}),
  };
}
