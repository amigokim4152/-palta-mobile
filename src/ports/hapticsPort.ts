import type { HapticIntent } from '../haptics/hapticIntent.js';

export interface HapticsPort {
  isAvailable(): Promise<boolean>;
  emit(intent: Exclude<HapticIntent, 'none'>): Promise<void>;
}
