import * as Location from 'expo-location';
import type { DeviceLocationPort } from '../services/locationPort';
import {
  normalizeExpoForegroundPermission,
  normalizeExpoLocation,
} from '../../../src/location/expoLocationContract';

export class ExpoLocationAdapter implements DeviceLocationPort {
  async getPermission() {
    const response = await Location.getForegroundPermissionsAsync();
    return normalizeExpoForegroundPermission(response);
  }

  async requestForegroundPermission() {
    const response = await Location.requestForegroundPermissionsAsync();
    return normalizeExpoForegroundPermission(response);
  }

  async getCurrentPosition() {
    const permission = await this.getPermission();
    if (permission !== 'granted_foreground') {
      throw new Error('foreground_location_permission_required');
    }

    // Prefer a recent last-known fix to make Neighborhood open quickly.
    const lastKnown = await Location.getLastKnownPositionAsync({
      maxAge: 30_000,
      requiredAccuracy: 150,
    });

    if (lastKnown) {
      return normalizeExpoLocation(lastKnown);
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return normalizeExpoLocation(current);
  }
}

export const expoLocationAdapter = new ExpoLocationAdapter();
