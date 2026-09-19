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

    // An explicit "use my location" action must prefer a fresh fix so that
    // Simulator/location changes and real user movement are reflected immediately.
    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return normalizeExpoLocation(current);
    } catch {
      // If a fresh fix is temporarily unavailable, a recent accurate fix is a
      // better fallback than exposing a native location error to the user.
    }

    try {
      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 30_000,
        requiredAccuracy: 150,
      });

      if (lastKnown) {
        return normalizeExpoLocation(lastKnown);
      }
    } catch {
      // Fall through to the user-facing unavailable message.
    }

    throw new Error(LOCATION_UNAVAILABLE_MESSAGE);
  }
}

export const expoLocationAdapter = new ExpoLocationAdapter();
