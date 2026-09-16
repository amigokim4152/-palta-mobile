import * as Haptics from 'expo-haptics';
import type { HapticsPort } from '../../../src/ports/hapticsPort';
import type { HapticIntent } from '../../../src/haptics/hapticIntent';

export class ExpoHapticsAdapter implements HapticsPort {
  async isAvailable(): Promise<boolean> {
    // Expo exposes best-effort platform haptics. Hardware quality varies.
    return true;
  }

  async emit(intent: Exclude<HapticIntent, 'none'>): Promise<void> {
    switch (intent) {
      case 'selection_confirmed':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
        return;
      case 'success':
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        );
        return;
      case 'warning':
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        );
        return;
      case 'error':
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Error,
        );
        return;
    }
  }
}
