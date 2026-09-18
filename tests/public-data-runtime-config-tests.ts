import { createPublicDataApiClient } from '../src/api/paltaApiFactory.js';
import type { FetchLike } from '../src/api/paltaApiClient.js';
import { parseRuntimeEnv } from '../src/config/runtimeEnv.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const withoutPublicData = parseRuntimeEnv({
  EXPO_PUBLIC_PALTA_API_BASE_URL: 'http://localhost:8787/',
  EXPO_PUBLIC_ENV: 'development',
});
assert(
  withoutPublicData.publicDataApiBaseUrl === undefined,
  'Public Data endpoint must remain optional until the Worker is deployed.',
);

const withPublicData = parseRuntimeEnv({
  EXPO_PUBLIC_PALTA_API_BASE_URL: 'https://api.somospalta.cl/',
  EXPO_PUBLIC_PUBLIC_DATA_API_BASE_URL: 'https://public.somospalta.cl/',
  EXPO_PUBLIC_ENV: 'production',
});
assert(
  withPublicData.publicDataApiBaseUrl === 'https://public.somospalta.cl',
  'Public Data endpoint should be normalized independently from the private Palta API.',
);

let insecureRejected = false;
try {
  parseRuntimeEnv({
    EXPO_PUBLIC_PALTA_API_BASE_URL: 'https://api.somospalta.cl',
    EXPO_PUBLIC_PUBLIC_DATA_API_BASE_URL: 'http://public.somospalta.cl',
    EXPO_PUBLIC_ENV: 'production',
  });
} catch {
  insecureRejected = true;
}
assert(insecureRejected, 'Production Public Data API must require HTTPS.');

let authorizationSeen = false;
const fetchMock: FetchLike = async (_url, init) => {
  authorizationSeen = Boolean(init?.headers?.Authorization);
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        api_version: 'v1',
        projection_version: 'pv-1',
        generated_at: '2026-09-18T20:00:00.000Z',
        comuna_code: '13132',
        items: [],
      };
    },
  };
};

const publicDataClient = createPublicDataApiClient({
  baseUrl: withPublicData.publicDataApiBaseUrl!,
  fetch: fetchMock,
});
await publicDataClient.getHome({ comunaCode: '13132' });
assert(
  authorizationSeen === false,
  'Public Data client must not attach the private Palta user access token.',
);

console.log('PASS: Public Data runtime endpoint remains optional, HTTPS-only and unauthenticated');
