import {
  submitBusinessQuickRegistration,
  type BusinessQuickRegistrationInput,
  type BusinessQuickRegistrationResult,
} from '../../../src/api/businessQuickRegistrationApiClient';
import { parseRuntimeEnv } from '../../../src/config/runtimeEnv';

export async function submitQuickBusinessRegistration(
  registration: BusinessQuickRegistrationInput,
): Promise<BusinessQuickRegistrationResult> {
  const env = parseRuntimeEnv({
    EXPO_PUBLIC_PALTA_API_BASE_URL: process.env.EXPO_PUBLIC_PALTA_API_BASE_URL,
    EXPO_PUBLIC_MAP_STYLE_URL: process.env.EXPO_PUBLIC_MAP_STYLE_URL,
    EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV,
  });
  const publicApiKey = process.env.EXPO_PUBLIC_PALTA_API_KEY?.trim();
  if (!publicApiKey) throw new Error('Palta public API key is not configured');

  return submitBusinessQuickRegistration({
    baseUrl: env.apiBaseUrl,
    publicApiKey,
    registration,
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      return {
        ok: response.ok,
        status: response.status,
        json: () => response.json(),
      };
    },
  });
}
