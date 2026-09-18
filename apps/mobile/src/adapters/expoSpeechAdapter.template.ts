import * as Speech from 'expo-speech';
import type {
  SpeechPort,
  SpeechRequest,
} from '../../../../src/ports/speechPort';

export class ExpoSpeechAdapter implements SpeechPort {
  async isAvailable(): Promise<boolean> {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.length > 0;
  }

  async speak(request: SpeechRequest): Promise<void> {
    Speech.speak(request.text, {
      language: request.locale,
      rate: request.rate,
      pitch: request.pitch,
    });
  }

  async stop(): Promise<void> {
    await Speech.stop();
  }

  // Pause/resume support differs by platform/runtime.
  // Leave these out until live device capability checks are complete.
}
