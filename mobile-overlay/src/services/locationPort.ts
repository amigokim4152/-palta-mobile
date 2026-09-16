import type {
  LocationPermission,
  LocationPoint,
} from '../../../src/location/locationCore';

export interface DeviceLocationPort {
  getPermission(): Promise<LocationPermission>;
  requestForegroundPermission(): Promise<LocationPermission>;
  getCurrentPosition(): Promise<LocationPoint>;
}

/**
 * Expo Location adapter is intentionally deferred until the real Expo project
 * is bootstrapped. Screens depend on this port, not directly on expo-location.
 */
export type LocationPortFactory = () => DeviceLocationPort;
