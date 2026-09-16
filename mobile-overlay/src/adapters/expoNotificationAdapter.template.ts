import * as Notifications from 'expo-notifications';
import type {
  NotificationMessage,
  NotificationPermission,
  NotificationPort,
} from '../../../src/ports/notificationPort';
import { routeNotification } from '../../../src/notifications/notificationRouting';

function normalizePermission(
  status: Notifications.PermissionStatus,
): NotificationPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'unknown';
}

export class ExpoNotificationAdapter implements NotificationPort {
  async getPermission(): Promise<NotificationPermission> {
    const result = await Notifications.getPermissionsAsync();
    return normalizePermission(result.status);
  }

  async requestPermission(): Promise<NotificationPermission> {
    const result = await Notifications.requestPermissionsAsync();
    return normalizePermission(result.status);
  }

  async registerDevice(): Promise<{ deviceToken: string }> {
    const token = await Notifications.getDevicePushTokenAsync();
    return { deviceToken: String(token.data) };
  }

  async openTarget(message: NotificationMessage): Promise<void> {
    const routed = routeNotification(message);
    if (routed.kind !== 'internal') return;

    // Router injection is preferred in real app bootstrap.
    // This template intentionally avoids coupling Core to Expo Router.
  }
}
