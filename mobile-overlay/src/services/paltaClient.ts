import {
  type BusinessApiDetail,
  type CareApiTrack,
  type HomeApiResponse,
  type LocalSearchItem,
} from '../../../src/api/paltaApiClient';
import type { PaltaLocale } from '../../../src/localization/index';
import { parseRuntimeEnv } from '../../../src/config/runtimeEnv';
import { createPaltaApiClient } from '../../../src/api/paltaApiFactory';
import type { AuthPort } from '../../../src/ports/authPort';

export type MobilePaltaClient = {
  getHome(locale?: PaltaLocale): Promise<HomeApiResponse>;
  searchLocal(input: {
    latitude: number;
    longitude: number;
    radiusM?: number;
    query?: string;
    locale?: PaltaLocale;
  }): Promise<LocalSearchItem[]>;
  getBusiness(id: string, locale?: PaltaLocale): Promise<BusinessApiDetail>;
  getCare(id: string): Promise<CareApiTrack>;
  createCare(input: {
    intentKey: string;
    subjectEntityId?: string;
    actionType?: string;
    payload?: Record<string, unknown>;
    idempotencyKey?: string;
  }): Promise<CareApiTrack>;
};

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
