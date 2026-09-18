import {
  type BusinessApiDetail,
  type CareApiTrack,
  type HomeApiResponse,
  type LocalSearchItem,
  type NotificationApiItem,
  type NotificationApiResponse,
  type ProfileApiResponse,
  type UpdateProfileApiInput,
} from '../../../src/api/paltaApiClient';
import type { PublicDataApiClient } from '../../../src/api/publicDataApiClient';
import { parseRuntimeEnv } from '../../../src/config/runtimeEnv';
import {
  createPaltaApiClient,
  createPublicDataApiClient,
} from '../../../src/api/paltaApiFactory';
import type { AuthPort } from '../../../src/ports/authPort';

export type MobilePaltaClient = {
  getHome(): Promise<HomeApiResponse>;
  getNotifications(): Promise<NotificationApiResponse>;
  markNotificationRead(id: string): Promise<NotificationApiItem>;
  getProfile(): Promise<ProfileApiResponse>;
  updateProfile(input: UpdateProfileApiInput): Promise<ProfileApiResponse>;
  searchLocal(input: {
    latitude: number;
    longitude: number;
    radiusM?: number;
    query?: string;
  }): Promise<LocalSearchItem[]>;
  getBusiness(id: string): Promise<BusinessApiDetail>;
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
      /**
       * Public canonical data transport only. HomeScreen intentionally does not
       * merge this directly; private relevance/composition must happen in the
       * Home/private-user layer before the final /v1/home payload is rendered.
       */
      publicDataClient?: PublicDataApiClient;
      environment: string;
      mapStyleUrl?: string;
    }
  | { status: 'config_error'; message: string };

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

    const fetchAdapter = async (
      input: string,
      init?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      },
    ) => {
      const response = await fetch(input, init);
      return {
        ok: response.ok,
        status: response.status,
        json: () => response.json(),
      };
    };

    const client = createPaltaApiClient({
      baseUrl: env.apiBaseUrl,
      fetch: fetchAdapter,
      ...(auth ? { auth } : {}),
    });
    const publicDataClient = env.publicDataApiBaseUrl
      ? createPublicDataApiClient({
          baseUrl: env.publicDataApiBaseUrl,
          fetch: fetchAdapter,
        })
      : undefined;

    return {
      status: 'ready',
      client,
      environment: env.environment,
      ...(publicDataClient ? { publicDataClient } : {}),
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
