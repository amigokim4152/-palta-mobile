import * as Location from 'expo-location';
import type { DeviceLocationPort } from '../services/locationPort';
import {
  normalizeExpoForegroundPermission,
  normalizeExpoLocation,
} from '../../../src/location/expoLocationContract';

const LOCATION_UNAVAILABLE_MESSAGE =
  'No pudimos detectar tu ubicación. Puedes explorar Santiago mientras tanto.';
const LOCATION_PERMISSION_REQUIRED_MESSAGE =
  'Necesitamos permiso de ubicación para buscar negocios cerca de ti.';

export class ExpoLocationAdapter implements DeviceLocationPort {
  async getPermission() {
    try {
      const response = await Location.getForegroundPermissionsAsync();
      return normalizeExpoForegroundPermission(response);
    } catch {
      throw new Error(LOCATION_UNAVAILABLE_MESSAGE);
    }
  }

  async requestForegroundPermission() {
    try {
      const response = await Location.requestForegroundPermissionsAsync();
      return normalizeExpoForegroundPermission(response);
    } catch {
      throw new Error(LOCATION_UNAVAILABLE_MESSAGE);
    }
  }

  async getCurrentPosition() {
    const permission = await this.getPermission();
    if (permission !== 'granted_foreground') {
      throw new Error(LOCATION_PERMISSION_REQUIRED_MESSAGE);
    }

    // Prefer a recent last-known fix to make Neighborhood open quickly.
    try {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 30_000,
        requiredAccuracy: 150,
      });

      if (lastKnown) {
        return normalizeExpoLocation(lastKnown);
      }
    } catch {
      // A missing last-known fix must not block a fresh location attempt.
    }

    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return normalizeExpoLocation(current);
    } catch {
      throw new Error(LOCATION_UNAVAILABLE_MESSAGE);
    }
  }
}

export const expoLocationAdapter = new ExpoLocationAdapter();
