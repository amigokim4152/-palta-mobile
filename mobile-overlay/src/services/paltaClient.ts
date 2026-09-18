import { parseRuntimeEnv } from '../../../src/config/runtimeEnv';
import { createPaltaApiClient } from '../../../src/api/paltaApiFactory';
import type { AuthPort } from '../../../src/ports/authPort';

const SHARED_DEV_MAP_STYLE_URL =
  'https://palta-edge-preflight.kimeuisin.workers.dev/maps/style.json';

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

    const client = createPaltaApiClient({
      baseUrl: env.apiBaseUrl,
      fetch: async (input, init) => {
        const response = await fetch(input, init);
        return {
          ok: response.ok,
          status: response.status,
          json: () => response.json(),
        };
      },
      ...(auth ? { auth } : {}),
    });

    // Local Business consumes the shared Map Core. In development, use the
    // currently verified Palta style endpoint when no local env override is
    // present so an already-running simulator can render MapLibre immediately.
    // Preview/production remain explicit configuration only.
    const mapStyleUrl =
      env.mapStyleUrl ??
      (env.environment === 'development' ? SHARED_DEV_MAP_STYLE_URL : undefined);

    return {
      status: 'ready',
      client,
      environment: env.environment,
      ...(mapStyleUrl ? { mapStyleUrl } : {}),
    };
  } catch (error) {
    return {
      status: 'config_error',
      message: error instanceof Error ? error.message : 'Invalid runtime config',
    };
  }
}

export const mobileRuntime = createMobileRuntime();
