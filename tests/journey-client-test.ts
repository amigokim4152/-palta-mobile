import { JourneyApiError, JourneyClient } from '../src/journey/journeyClient.js';
import type { FetchLike } from '../src/api/paltaApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const validResponse = {
  status: 'GREEN',
  departure_time: '2026-09-16T12:00:00-03:00',
  origin: { lat: -33.4, lon: -70.6 },
  destination: { lat: -33.44, lon: -70.65 },
  public_modes: ['auto', 'transit', 'bicycle', 'pedestrian'],
  results: {
    auto: {
      status: 'OK',
      options: [
        {
          mode: 'auto',
          duration_seconds: 600,
          distance_meters: 10680,
          legs: [
            {
              mode: 'auto',
              duration_seconds: 600,
              distance_meters: 10680,
              realtime: false,
            },
          ],
          transfers: 0,
          realtime: false,
          source: 'valhalla',
        },
      ],
    },
    transit: { status: 'NO_ROUTE', options: [] },
    bicycle: { status: 'NO_ROUTE', options: [] },
    pedestrian: { status: 'NO_ROUTE', options: [] },
  },
};

let seenUrl = '';
let seenMethod = '';
let seenHeaders: Record<string, string> = {};
let seenBody = '';

const fetchOk: FetchLike = async (url, init) => {
  seenUrl = url;
  seenMethod = init?.method ?? '';
  seenHeaders = init?.headers ?? {};
  seenBody = init?.body ?? '';
  return {
    ok: true,
    status: 200,
    async json() {
      return validResponse;
    },
  };
};

const client = new JourneyClient({
  baseUrl: 'https://api.somospalta.cl/',
  fetch: fetchOk,
  getAccessToken: async () => 'user-token-123',
});

const result = await client.plan({
  origin: { lat: -33.4, lon: -70.6 },
  destination: { lat: -33.44, lon: -70.65 },
  departure_time: '2026-09-16T12:00:00-03:00',
});

assert(seenUrl === 'https://api.somospalta.cl/v1/journey', 'Journey client must call /v1/journey.');
assert(seenMethod === 'POST', 'Journey client must use POST.');
assert(seenHeaders.Authorization === 'Bearer user-token-123', 'Journey client must attach user-scoped Bearer auth.');
assert(!('X-Palta-Dev-Key' in seenHeaders), 'Mobile Journey client must never send the shared dev key.');
assert(JSON.parse(seenBody).origin.lat === -33.4, 'Journey request body must preserve coordinates.');
assert(result.status === 'GREEN', 'Valid Journey response should parse successfully.');
assert(result.results.auto.options[0]?.source === 'valhalla', 'Journey option source should survive parsing.');

const badModeClient = new JourneyClient({
  baseUrl: 'https://api.somospalta.cl',
  fetch: async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        ...validResponse,
        public_modes: ['auto', 'transit', 'bicycle', 'motorcycle'],
      };
    },
  }),
});

let badModeRejected = false;
try {
  await badModeClient.plan({
    origin: { lat: -33.4, lon: -70.6 },
    destination: { lat: -33.44, lon: -70.65 },
  });
} catch {
  badModeRejected = true;
}
assert(badModeRejected, 'Journey v1 must reject non-public motorcycle mode.');

const httpFailureClient = new JourneyClient({
  baseUrl: 'https://api.somospalta.cl',
  fetch: async () => ({
    ok: false,
    status: 503,
    async json() {
      return { error: 'upstream_unavailable', detail: 'Journey engine unavailable' };
    },
  }),
});

let typedFailure = false;
try {
  await httpFailureClient.plan({
    origin: { lat: -33.4, lon: -70.6 },
    destination: { lat: -33.44, lon: -70.65 },
  });
} catch (error) {
  typedFailure =
    error instanceof JourneyApiError &&
    error.status === 503 &&
    error.code === 'upstream_unavailable';
}
assert(typedFailure, 'Journey HTTP failures must remain typed JourneyApiError values.');

let invalidCoordinateRejected = false;
try {
  await client.plan({
    origin: { lat: 120, lon: -70.6 },
    destination: { lat: -33.44, lon: -70.65 },
  });
} catch {
  invalidCoordinateRejected = true;
}
assert(invalidCoordinateRejected, 'Journey client must reject invalid coordinates before network access.');

console.log('PASS: Palta Journey v1 client tests');
