import { parseRuntimeEnv } from '../../../src/config/runtimeEnv';
import { createPaltaApiClient } from '../../../src/api/paltaApiFactory';
import type { AuthPort } from '../../../src/ports/authPort';

/**
 * Mobile uses the canonical API client directly. Do not mirror its methods in a
 * second hand-maintained interface; new domain contracts must become available
 * through the same typed client everywhere.
 */
export type MobilePaltaClient = ReturnType<typeof createPaltaApiClient>;

export type MobileRuntime =
  | {
      status: 'ready';
      client: MobilePaltaClient;
      environment: string;
      mapStyleUrl?: string;
    }
  | { status: 'config_error'; message: string };

export function createMobileRuntime(auth?: AuthPort): MobileRuntime {
  try {
    const env = parseRuntimeEnv({
      EXPO_PUBLIC_PALTA_API_BASE_URL:
        process.env.EXPO_PUBLIC_PALTA_API_BASE_URL,
      EXPO_PUBLIC_MAP_STYLE_URL: process.env.EXPO_PUBLIC_MAP_STYLE_URL,
      EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV,
    });
    const publicApiKey = process.env.EXPO_PUBLIC_PALTA_API_KEY?.trim();

    const client = createPaltaApiClient({
      baseUrl: env.apiBaseUrl,
      fetch: async (input, init) => {
        const response = await fetch(input, {
          ...init,
          headers: {
            ...(init?.headers ?? {}),
            ...(publicApiKey ? { apikey: publicApiKey } : {}),
          },
        });
        return {
          ok: response.ok,
          status: response.status,
          json: () => response.json(),
        };
      },
      ...(auth ? { auth } : {}),
    });

    return {
      status: 'ready',
      client,
      environment: env.environment,
      ...(env.mapStyleUrl ? { mapStyleUrl: env.mapStyleUrl } : {}),
    };
  } catch (error) {
    return {
      status: 'config_error',
      message: error instanceof Error ? error.message : 'Invalid runtime config',
    };
  }
}

export const mobileRuntime = createMobileRuntime();
