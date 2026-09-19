import type { PublicDataApiClient } from '../../../src/api/publicDataApiClient';
import { parseRuntimeEnv } from '../../../src/config/runtimeEnv';
import {
  createPaltaApiClient,
  createPublicDataApiClient,
} from '../../../src/api/paltaApiFactory';
import type { AuthPort } from '../../../src/ports/authPort';
import { createSupabaseAuthPort } from '../adapters/createSupabaseAuthPort';

const SHARED_DEV_MAP_STYLE_URL =
  'https://palta-map-edge.kimeuisin.workers.dev/maps/cl/style.json';

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
      publicDataClient?: PublicDataApiClient;
      environment: string;
      mapStyleUrl?: string;
    }
  | { status: 'config_error'; message: string };

function isSameSupabaseEdgeOrigin(apiBaseUrl: string, supabaseUrl?: string): boolean {
  if (!supabaseUrl) return false;
  try {
    const api = new URL(apiBaseUrl);
    const supabase = new URL(supabaseUrl);
    return api.origin === supabase.origin && api.pathname.startsWith('/functions/v1/');
  } catch {
    return false;
  }
}

export function createMobileRuntime(auth?: AuthPort): MobileRuntime {
  try {
    const env = parseRuntimeEnv({
      EXPO_PUBLIC_PALTA_API_BASE_URL:
        process.env.EXPO_PUBLIC_PALTA_API_BASE_URL,
      EXPO_PUBLIC_PUBLIC_DATA_API_BASE_URL:
        process.env.EXPO_PUBLIC_PUBLIC_DATA_API_BASE_URL,
      EXPO_PUBLIC_MAP_STYLE_URL: process.env.EXPO_PUBLIC_MAP_STYLE_URL,
      EXPO_PUBLIC_ENV: process.env.EXPO_PUBLIC_ENV,
    });

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
    const supabasePublishableKey =
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    const usesSupabaseEdgeApi = isSameSupabaseEdgeOrigin(env.apiBaseUrl, supabaseUrl);

    if (usesSupabaseEdgeApi && !supabasePublishableKey) {
      throw new Error(
        'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required when Palta API uses Supabase Edge Functions',
      );
    }

    const client = createPaltaApiClient({
      baseUrl: env.apiBaseUrl,
      fetch: async (input, init) => {
        const headers: Record<string, string> = {
          ...(init?.headers ?? {}),
        };
        if (usesSupabaseEdgeApi && supabasePublishableKey) {
          headers.apikey = supabasePublishableKey;
        }
        const response = await fetch(input, {
          ...init,
          headers,
        });
        return {
          ok: response.ok,
          status: response.status,
          json: () => response.json(),
        };
      },
      ...(auth ? { auth } : {}),
    });

    const publicDataClient = env.publicDataApiBaseUrl
      ? createPublicDataApiClient({
          baseUrl: env.publicDataApiBaseUrl,
          fetch: async (input, init) => {
            const response = await fetch(input, init);
            return {
              ok: response.ok,
              status: response.status,
              json: () => response.json(),
            };
          },
        })
      : undefined;

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
      ...(publicDataClient ? { publicDataClient } : {}),
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

/**
 * Authenticated surfaces reuse the same singleton Supabase AuthPort owned by
 * AuthRuntimeProvider. The adapter resolves/refreshed access tokens per request;
 * callers must not snapshot or persist bearer tokens themselves.
 */
let authenticatedRuntime: MobileRuntime | null = null;
export function getAuthenticatedMobileRuntime(): MobileRuntime {
  if (authenticatedRuntime) return authenticatedRuntime;
  try {
    authenticatedRuntime = createMobileRuntime(createSupabaseAuthPort());
  } catch (error) {
    authenticatedRuntime = {
      status: 'config_error',
      message: error instanceof Error ? error.message : 'Invalid authenticated runtime config',
    };
  }
  return authenticatedRuntime;
}

export const mobileRuntime = createMobileRuntime();
