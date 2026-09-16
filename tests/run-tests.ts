import { canPublishControlledOffer } from "../mobile-overlay/src/features/business/capabilities.js";
import { composeHome } from '../src/home/homeComposer.js';
import { resolveDelivery } from '../src/notification/deliveryPolicy.js';
import { attachResult, recordOutcome, transitionCare, type CareTrack } from '../src/care/careMachine.js';
import { canAffectImmediateContext, explorationIsLifeFact, isConfirmedLifeArea, setExploringLocation } from '../src/location/locationContext.js';
import { shouldRecheck, shouldSuppress } from '../src/eligibility/eligibility.js';
import type { HomeCandidate, LocationContext } from '../src/core/contracts.js';
import type { MapBrowseState } from '../src/adapters/mapCore.js';
import { CREATE_IS_PRIMARY_SURFACE, MAP_IS_PRIMARY_SURFACE, PRIMARY_SURFACES } from '../src/navigation/surfaces.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function candidate(overrides: Partial<HomeCandidate> & Pick<HomeCandidate, 'id' | 'kind' | 'dedupeKey'>): HomeCandidate {
  const { id, kind, dedupeKey, ...rest } = overrides;
  return {
    id,
    domain: 'other',
    kind,
    title: id,
    urgency: 1,
    importance: 2,
    relevance: 0.7,
    actionRequired: false,
    waitingState: false,
    confidence: 'confirmed',
    freshness: 'current',
    dedupeKey,
    ...rest,
  };
}

const now = new Date('2026-09-16T12:00:00.000Z');

// Sparse Home may surface useful content, but does not fill with weak content.
const sparse = composeHome([
  candidate({ id: 'car', kind: 'action', dedupeKey: 'car', urgency: 3, importance: 4, actionRequired: true }),
  candidate({ id: 'news-good', kind: 'content', dedupeKey: 'news-good', domain: 'news', importance: 3, relevance: 0.8 }),
  candidate({ id: 'news-weak', kind: 'content', dedupeKey: 'news-weak', domain: 'news', importance: 0, relevance: 0.1, confidence: 'unknown' }),
], { now });
assert(sparse.primary.length === 1, 'Expected one primary life card.');
assert(sparse.secondary.some((item) => item.id === 'news-good'), 'Useful news should appear on sparse Home.');
assert(!sparse.secondary.some((item) => item.id === 'news-weak'), 'Weak content must not be used to fill Home.');

// Busy Home suppresses most discovery content.
const busyInputs: HomeCandidate[] = Array.from({ length: 6 }, (_, i) =>
  candidate({ id: `action-${i}`, kind: 'action', dedupeKey: `action-${i}`, urgency: 2, importance: 3, actionRequired: true }),
);
busyInputs.push(candidate({ id: 'news-1', kind: 'content', dedupeKey: 'news-1', importance: 4, relevance: 1 }));
busyInputs.push(candidate({ id: 'news-2', kind: 'content', dedupeKey: 'news-2', importance: 4, relevance: 1 }));
const busy = composeHome(busyInputs, { now });
assert(busy.secondary.length <= 1, 'Busy Home should keep discovery content subordinate.');

// Content does not become engagement push by default.
assert(resolveDelivery(candidate({ id: 'content', kind: 'content', dedupeKey: 'content', urgency: 4, importance: 4 })) === 'home', 'Content should default to Home, not push.');

// RESULT and OUTCOME remain separate.
let care: CareTrack = { id: 'care-1', state: 'discovered' };
care = transitionCare(care, 'start_action');
care = transitionCare(care, 'wait');
care = attachResult(care, { summary: 'Approved', observedAt: now.toISOString() });
assert(care.state === 'result_available', 'Result must create result_available state.');
care = transitionCare(care, 'complete');
assert(care.outcome === undefined, 'Completion/result must not fabricate an outcome.');
care = recordOutcome(care, { summary: 'Issue resolved', recordedAt: now.toISOString() });
assert(care.state === 'outcome_recorded' && care.outcome?.summary === 'Issue resolved', 'Outcome should be recorded separately.');

// Exploring a place is not a life fact.
const locations: LocationContext = { savedPlaces: [] };
const explored = { id: 'santiago', label: 'Santiago' };
const exploredContext = setExploringLocation(locations, explored);
assert(exploredContext.exploringLocation?.id === 'santiago', 'Exploring location should be stored separately.');
assert(explorationIsLifeFact() === false, 'Exploration must not become a confirmed life fact.');
assert(isConfirmedLifeArea(explored, exploredContext) === false, 'Exploration alone must not become a confirmed life area.');
assert(canAffectImmediateContext(explored, exploredContext) === false, 'Exploration alone must not affect immediate Home context.');

// Current GPS may affect immediate context without becoming a durable life fact.
const currentContext: LocationContext = { savedPlaces: [], currentLocation: explored };
assert(canAffectImmediateContext(explored, currentContext), 'Current GPS should be usable for immediate local context.');
assert(!isConfirmedLifeArea(explored, currentContext), 'Current GPS alone must not become a durable life area.');

// Primary IA is fixed; map/create remain contextual.
assert(PRIMARY_SURFACES.join('|') === 'home|neighborhood|community|market|play', 'Primary mobile surfaces must remain fixed.');
assert(MAP_IS_PRIMARY_SURFACE === false && CREATE_IS_PRIMARY_SURFACE === false, 'Map/create must remain contextual, not permanent bottom tabs.');

// Eligibility suppression expires when rules/version/user conditions change.
const suppression = {
  ruleSignature: 'age>=65',
  policyVersion: 'v1',
  userConditionSignature: 'age=45',
  suppressedAt: now.toISOString(),
};
const decision = {
  state: 'not_eligible' as const,
  ruleSignature: 'age>=65',
  policyVersion: 'v1',
  evaluatedAt: now.toISOString(),
};
assert(shouldSuppress(decision, suppression, 'age=45'), 'Stable not-eligible condition should suppress repeats.');
assert(shouldRecheck(suppression, 'age>=60', 'v2', 'age=45'), 'Changed policy should trigger recheck.');


// Route/deep-link targets use stable semantic IDs and preserve return context.
const { entityPath, shouldPreserveReturnState } = await import('../src/navigation/routeContract.js');
assert(entityPath({ kind: 'care', id: 'care/123' }) === '/care/care%2F123', 'Care route must encode stable semantic ID.');
assert(shouldPreserveReturnState('neighborhood', { kind: 'business', id: 'biz-1' }), 'Neighborhood -> business must preserve return state.');

// Offline intent is never falsely marked confirmed before sync outcome.
const { markSyncing, resolveSync } = await import('../src/mobile/syncState.js');
let pending = { id: 'a1', createdAt: now.toISOString(), state: 'local_pending' as const, payload: { businessId: 'biz-1' }, attempts: 0 };
const syncing = markSyncing(pending);
assert(syncing.state === 'syncing' && syncing.attempts === 1, 'Local action should enter syncing explicitly.');
const retryable = resolveSync(syncing, 'retryable_error', 'offline');
assert(retryable.state === 'failed_retryable', 'Network failure must preserve retryable intent instead of fabricating success.');

// One real-world business stays one canonical object across surfaces.
const { canonicalBusinessIsStable } = await import('../src/verticalSlice/localBusinessFlow.js');
assert(canonicalBusinessIsStable('biz-1', 'biz-1', 'biz-1'), 'Canonical Business ID must remain stable across surfaces.');
assert(!canonicalBusinessIsStable('biz-1', 'biz-2', 'biz-1'), 'Duplicate/forked Business IDs must fail the vertical-slice invariant.');

console.log('PASS: palta-app core regression tests');

assert(canPublishControlledOffer("verified") === true, "verified business may publish controlled offer");
assert(canPublishControlledOffer("unverified") === false, "unverified business must not publish controlled offer");


// Map Core keeps browsing selection and "search this area" state explicit.
const {
  markMapMoved,
  applyViewportSearch,
  selectMapEntity,
} = await import('../src/adapters/mapCore.js');
let mapState: MapBrowseState = {
  camera: null,
  bounds: null,
  selectedEntityId: null,
  mapMovedSinceSearch: false,
};
mapState = markMapMoved(mapState);
assert(mapState.mapMovedSinceSearch === true, 'Moving the map should expose search-this-area state.');
mapState = selectMapEntity(mapState, 'biz-1');
assert(mapState.selectedEntityId === 'biz-1', 'Map/list must share the selected canonical entity.');
mapState = applyViewportSearch(mapState, {
  northEast: { latitude: -33.30, longitude: -70.50 },
  southWest: { latitude: -33.50, longitude: -70.70 },
});
assert(mapState.mapMovedSinceSearch === false, 'Viewport search should clear the dirty-map flag.');

// Offline writes preserve user intent and retry ordering.
const {
  enqueueMutation,
  startMutation,
  failMutation,
  shouldRetryMutation,
  pendingMutationsInOrder,
} = await import('../src/mobile/offlineMutationQueue.js');
const q1 = enqueueMutation({
  id: 'm1',
  kind: 'quote_request',
  payload: { businessId: 'biz-1' },
  now: '2026-09-16T12:00:00.000Z',
});
const q2 = enqueueMutation({
  id: 'm2',
  kind: 'save_business',
  payload: { businessId: 'biz-2' },
  now: '2026-09-16T12:01:00.000Z',
});
const q1Syncing = startMutation(q1, '2026-09-16T12:02:00.000Z');
const q1Failed = failMutation(q1Syncing, {
  retryable: true,
  error: 'offline',
  now: '2026-09-16T12:03:00.000Z',
});
assert(shouldRetryMutation(q1Failed), 'Retryable offline action must remain retryable.');
const queued = pendingMutationsInOrder([q2, q1Failed]);
assert(queued[0]?.id === 'm1' && queued[1]?.id === 'm2', 'Offline intents must preserve creation order.');

// Deep links are allow-listed and return to exact semantic state.
const {
  toPaltaDeepLink,
  parsePaltaDeepLink,
} = await import('../src/navigation/deepLink.js');
const careLink = toPaltaDeepLink({ kind: 'care', id: 'care/123' });
assert(careLink === 'palta://care/care%2F123', 'Care deep link must encode stable ID.');
const parsedCare = parsePaltaDeepLink(careLink);
assert(parsedCare?.kind === 'care' && parsedCare.id === 'care/123', 'Care deep link must round-trip.');
assert(parsePaltaDeepLink('palta://admin/secret') === null, 'Unknown deep-link surfaces must be rejected.');

// Runtime config must reject insecure remote API URLs.
const { parseRuntimeEnv } = await import('../src/config/runtimeEnv.js');
const devEnv = parseRuntimeEnv({
  EXPO_PUBLIC_PALTA_API_BASE_URL: 'http://localhost:8787/',
  EXPO_PUBLIC_ENV: 'development',
});
assert(devEnv.apiBaseUrl === 'http://localhost:8787', 'Local development URL should normalize trailing slash.');
let insecureRejected = false;
try {
  parseRuntimeEnv({
    EXPO_PUBLIC_PALTA_API_BASE_URL: 'http://api.somospalta.cl',
    EXPO_PUBLIC_ENV: 'production',
  });
} catch {
  insecureRejected = true;
}
assert(insecureRejected, 'Remote production API must require HTTPS.');

// API client injects auth token and validates minimum response shape.
const { PaltaApiClient, PaltaApiError } = await import('../src/api/paltaApiClient.js');
const seenRequests: Array<{
  url: string;
  init:
    | {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      }
    | undefined;
}> = [];
const fakeFetch = async (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => {
  seenRequests.push({ url, init });
  return {
    ok: true,
    status: 200,
    async json() {
      if (url.includes('/v1/home')) return { items: [] };
      if (url.includes('/v1/local/search')) return { items: [] };
      if (url.endsWith('/v1/care')) {
        return { id: 'care-9', intent_key: 'quote', state: 'wait' };
      }
      return {};
    },
  };
};
const api = new PaltaApiClient({
  baseUrl: 'https://api.somospalta.cl/',
  fetch: fakeFetch,
  getAccessToken: async () => 'token-123',
});
await api.getHome();
await api.searchLocal({ latitude: -33.4, longitude: -70.6 });
const createdCare = await api.createCare({
  intentKey: 'vehicle_repair_quote',
  subjectEntityId: 'biz-1',
  idempotencyKey: 'mutation-123',
});
assert(createdCare.id === 'care-9', 'Palta API client should return validated Care track.');
assert(
  seenRequests.every((request) => request.init?.headers?.Authorization === 'Bearer token-123'),
  'Palta API client must attach the current access token.',
);

const failingApi = new PaltaApiClient({
  baseUrl: 'https://api.somospalta.cl',
  fetch: async () => ({
    ok: false,
    status: 503,
    async json() { return {}; },
  }),
});
let status503 = false;
try {
  await failingApi.getHome();
} catch (error) {
  status503 = error instanceof PaltaApiError && error.status === 503;
}
assert(status503, 'HTTP failures must remain typed PaltaApiError values.');

console.log('PASS: palta-app v2.3 adapter regression tests');


// First vertical slice: business quote becomes Care online, or durable intent offline.
const { requestBusinessQuote } = await import('../src/verticalSlice/quoteRequestFlow.js');
const onlineQuote = await requestBusinessQuote({
  online: true,
  api,
  request: {
    businessId: 'biz-1',
    description: 'Ruido al frenar',
  },
  mutationId: 'mut-online-unused',
  now: now.toISOString(),
});
assert(
  onlineQuote.mode === 'online' && onlineQuote.nextPath === '/care/care-9',
  'Online quote request should create Care and return the exact Care path.',
);

const offlineQuote = await requestBusinessQuote({
  online: false,
  api,
  request: {
    businessId: 'biz-1',
    description: 'Ruido al frenar',
  },
  mutationId: 'mut-offline-1',
  now: now.toISOString(),
});
assert(
  offlineQuote.mode === 'queued_offline' &&
    offlineQuote.mutation.state === 'pending' &&
    offlineQuote.mutation.payload.businessId === 'biz-1',
  'Offline quote request must preserve the exact user intent without fabricating success.',
);

// API Home payload projects into the same domain-neutral Home Candidate model.
const { projectHomeApiItem } = await import('../src/home/homeApiProjection.js');
const projectedStatus = projectHomeApiItem({
  id: 'home-1',
  kind: 'status',
  title: 'Esperando cotizaciones',
  source_domain: 'local_business',
  delivery: 'home',
  care_track_id: 'care-9',
});
assert(
  projectedStatus.kind === 'status' &&
    projectedStatus.waitingState === true &&
    projectedStatus.action?.target === '/care/care-9',
  'API Home status should project back into the shared Home/Care model.',
);

console.log('PASS: palta-app v2.3 first vertical slice tests');


// v2.5 API detail reads and private-LAN development runtime.
const lanEnv = parseRuntimeEnv({
  EXPO_PUBLIC_PALTA_API_BASE_URL: 'http://192.168.1.20:8787/',
  EXPO_PUBLIC_ENV: 'development',
});
assert(
  lanEnv.apiBaseUrl === 'http://192.168.1.20:8787',
  'Development should allow an explicit private LAN API URL for physical-device testing.',
);

let productionLanRejected = false;
try {
  parseRuntimeEnv({
    EXPO_PUBLIC_PALTA_API_BASE_URL: 'http://192.168.1.20:8787',
    EXPO_PUBLIC_ENV: 'production',
  });
} catch {
  productionLanRejected = true;
}
assert(
  productionLanRejected,
  'Production must reject insecure private-LAN HTTP.',
);

const detailRequests: string[] = [];
const detailApi = new PaltaApiClient({
  baseUrl: 'https://api.somospalta.cl',
  fetch: async (url) => {
    detailRequests.push(url);
    if (url.includes('/v1/business/')) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: 'biz-1',
            name: 'Taller',
            verification_status: 'unverified',
          };
        },
      };
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: 'care-1',
          intent_key: 'local_business_quote',
          state: 'wait',
        };
      },
    };
  },
});
const businessDetail = await detailApi.getBusiness('biz/1');
const careDetail = await detailApi.getCare('care/1');
assert(
  businessDetail.id === 'biz-1' &&
    detailRequests[0]?.endsWith('/v1/business/biz%2F1'),
  'Business detail IDs must be URL encoded and minimally validated.',
);
assert(
  careDetail.id === 'care-1' &&
    detailRequests[1]?.endsWith('/v1/care/care%2F1'),
  'Care detail IDs must be URL encoded and minimally validated.',
);

console.log('PASS: palta-app v2.5 mobile API boundary tests');


// v2.6 Location Core keeps exploration separate from confirmed life areas.
const {
  initialLocationCoreState,
  observeCurrentLocation,
  setExploringLocation: setCoreExploringLocation,
  setConfirmedHomeArea,
  resolveNeighborhoodLocation,
  canPromoteToLifeArea,
} = await import('../src/location/locationCore.js');

let locationCore = initialLocationCoreState();
locationCore = setConfirmedHomeArea(
  locationCore,
  { latitude: -33.38, longitude: -70.57 },
  'Vitacura',
);
locationCore = observeCurrentLocation(
  locationCore,
  { latitude: -33.45, longitude: -70.66, accuracyM: 15 },
  now.toISOString(),
);
locationCore = setCoreExploringLocation(
  locationCore,
  { latitude: -33.04, longitude: -71.62 },
  'Valparaíso',
);
const resolvedLocation = resolveNeighborhoodLocation(locationCore);
assert(
  resolvedLocation?.source === 'exploring',
  'Exploring location should control the current browse context without becoming life truth.',
);
assert(
  resolvedLocation !== null && canPromoteToLifeArea(resolvedLocation) === false,
  'Exploring location must not be automatically promotable to a life area.',
);
assert(
  locationCore.homeArea?.label === 'Vitacura',
  'Confirmed home area must remain unchanged while exploring elsewhere.',
);

// v2.6 Mutation sync engine preserves intent and classifies retry/terminal failures.
const {
  InMemoryMutationQueueStore,
  syncPendingMutations,
} = await import('../src/mobile/mutationSyncEngine.js');
const syncStore = new InMemoryMutationQueueStore();
await syncStore.put(
  enqueueMutation({
    id: 'sync-1',
    kind: 'quote_request',
    payload: { businessId: 'biz-1' },
    now: '2026-09-16T10:00:00.000Z',
  }),
);
await syncStore.put(
  enqueueMutation({
    id: 'sync-2',
    kind: 'save_business',
    payload: { businessId: 'biz-2' },
    now: '2026-09-16T10:01:00.000Z',
  }),
);

let syncCounter = 0;
const syncReport = await syncPendingMutations({
  store: syncStore,
  now: () => `2026-09-16T10:0${++syncCounter}:30.000Z`,
  execute: async (mutation) =>
    mutation.id === 'sync-1'
      ? { ok: true as const }
      : {
          ok: false as const,
          retryable: true,
          error: 'offline',
        },
});

assert(
  syncReport.succeeded === 1 && syncReport.retryableFailures === 1,
  'Sync engine must separate success from retryable failure.',
);
const syncRemaining = await syncStore.list();
assert(
  syncRemaining.length === 1 &&
    syncRemaining[0]?.id === 'sync-2' &&
    syncRemaining[0]?.state === 'failed_retryable',
  'Successful mutation should be removed while retryable user intent remains durable.',
);

console.log('PASS: palta-app v2.6 location/offline core tests');


// v2.7 Expo Location contract normalization.
const {
  normalizeExpoForegroundPermission,
  normalizeExpoLocation,
} = await import('../src/location/expoLocationContract.js');

assert(
  normalizeExpoForegroundPermission({ status: 'granted' }) ===
    'granted_foreground',
  'Granted Expo foreground permission must normalize correctly.',
);
assert(
  normalizeExpoForegroundPermission({
    status: 'denied',
    canAskAgain: false,
  }) === 'restricted',
  'Permanent permission denial should be distinguishable from a normal denial.',
);
const normalizedLocation = normalizeExpoLocation({
  coords: {
    latitude: -33.4,
    longitude: -70.6,
    accuracy: 12.5,
  },
});
assert(
  normalizedLocation.accuracyM === 12.5,
  'Expo device accuracy should survive normalization.',
);

// v2.7 SQLite mutation codec.
const {
  encodeMutationRow,
  decodeMutationRow,
} = await import('../src/mobile/sqliteMutationCodec.js');

const mutationForSql = enqueueMutation({
  id: 'sqlite-1',
  kind: 'business_quote_request',
  payload: { businessId: 'biz-1', note: 'hola' },
  now: '2026-09-16T12:00:00.000Z',
});
const encodedRow = encodeMutationRow(mutationForSql);
const decodedMutation = decodeMutationRow(encodedRow);
assert(
  decodedMutation.id === mutationForSql.id &&
    decodedMutation.payload.businessId === 'biz-1',
  'SQLite row codec must round-trip durable user intent.',
);

let invalidRowRejected = false;
try {
  decodeMutationRow({
    ...encodedRow,
    state: 'invented_state',
  });
} catch {
  invalidRowRejected = true;
}
assert(
  invalidRowRejected,
  'SQLite queue must reject unknown persisted states instead of silently accepting corruption.',
);

// v2.7 canonical map features become GeoJSON points without duplicating entities.
const { toPointFeatureCollection } = await import(
  '../src/map/mapFeatureCollection.js'
);
const pointCollection = toPointFeatureCollection([
  {
    id: 'biz-1',
    entityType: 'business',
    coordinate: { latitude: -33.4, longitude: -70.6 },
    title: 'Taller',
    categoryKey: 'auto_repair',
    selected: true,
  },
]);
assert(
  pointCollection.features.length === 1 &&
    pointCollection.features[0]?.properties.entityId === 'biz-1' &&
    pointCollection.features[0]?.geometry.coordinates[0] === -70.6,
  'Map layer input must preserve canonical entity identity and lng/lat order.',
);

console.log('PASS: palta-app v2.7 native adapter contract tests');


// v2.8 retry classification + stable client mutation IDs.
const {
  isRetryableMutationError,
  createClientMutationId,
} = await import('../src/api/retryPolicy.js');

assert(
  isRetryableMutationError(new PaltaApiError('server', 503)) === true,
  '5xx write failures must be retryable.',
);
assert(
  isRetryableMutationError(new PaltaApiError('validation', 400)) === false,
  'Validation failures must not be queued for blind retry.',
);
assert(
  createClientMutationId(123456789, 0.123456) ===
    createClientMutationId(123456789, 0.123456),
  'Client mutation ID generation must be deterministic for the same inputs.',
);

// Idempotency key must be sent on Care creation when provided.
const idempotentRequests: Array<{
  headers: Record<string, string> | undefined;
}> = [];
const idempotentApi = new PaltaApiClient({
  baseUrl: 'https://api.somospalta.cl',
  fetch: async (_url, init) => {
    idempotentRequests.push({ headers: init?.headers });
    return {
      ok: true,
      status: 201,
      async json() {
        return {
          id: 'care-idem-1',
          intent_key: 'quote',
          state: 'wait',
        };
      },
    };
  },
});
await idempotentApi.createCare({
  intentKey: 'quote',
  idempotencyKey: 'mutation-abc',
});
assert(
  idempotentRequests[0]?.headers?.['Idempotency-Key'] === 'mutation-abc',
  'Care creation must forward the stable Idempotency-Key.',
);

console.log('PASS: palta-app v2.8 idempotency/retry tests');


// v2.9 Cloudflare/R2 range header correctness.
const {
  resolveByteRange,
  contentRangeHeader,
} = await import('../src/cloudflare/rangeHeaders.js');

const first16 = resolveByteRange({ offset: 0, length: 16 }, 100);
assert(
  first16.start === 0 &&
    first16.end === 15 &&
    first16.length === 16,
  'Offset/length range resolution must be inclusive and exact.',
);
assert(
  contentRangeHeader({ offset: 90, length: 20 }, 100) ===
    'bytes 90-99/100',
  'Range length must be clipped at the end of the object.',
);
assert(
  contentRangeHeader({ suffix: 16 }, 100) === 'bytes 84-99/100',
  'Suffix byte range must resolve from the end of the object.',
);

let badRangeRejected = false;
try {
  resolveByteRange({ offset: 100, length: 1 }, 100);
} catch {
  badRangeRejected = true;
}
assert(
  badRangeRejected,
  'Unsatisfiable local range math must be rejected.',
);

console.log('PASS: palta-app v2.9 range contract tests');


// v3 provider independence contracts.
const { ProviderRegistry } = await import(
  '../src/persistence/providerRegistry.js'
);
const registry = new ProviderRegistry();
registry.bind({
  role: 'database',
  provider: 'supabase',
  status: 'primary',
  replaceable: true,
});
registry.bind({
  role: 'object_storage',
  provider: 'cloudflare-r2',
  status: 'primary',
  replaceable: true,
});
assert(
  registry.get('database')?.replaceable === true &&
    registry.get('object_storage')?.provider === 'cloudflare-r2',
  'Provider registry must treat infrastructure bindings as replaceable.',
);

const { routeNotification } = await import(
  '../src/notifications/notificationRouting.js'
);
const routedNotification = routeNotification({
  id: 'n1',
  title: 'Cotización lista',
  target: 'palta://care/care-123',
});
assert(
  routedNotification.kind === 'internal' &&
    routedNotification.path === '/care/care-123',
  'Notification routing must depend on Palta deep-link contracts, not an Expo-specific payload shape.',
);
assert(
  routeNotification({
    id: 'n2',
    title: 'bad',
    target: 'palta://admin/root',
  }).kind === 'ignored',
  'Unknown notification targets must be rejected by the Palta router.',
);

console.log('PASS: palta-app v3 provider-independence tests');


// v3.1 access policy keeps public discovery independent from private Home.
const {
  canOpenSurface,
  accessRequirementFor,
} = await import('../src/access/accessPolicy.js');

assert(
  canOpenSurface('business_detail', false) === true,
  'Public business detail must remain browseable without login.',
);
assert(
  canOpenSurface('home', false) === false &&
    accessRequirementFor('home') === 'authenticated',
  'Private Personal Home must require authentication.',
);
assert(
  canOpenSurface('neighborhood', false) === true,
  'Neighborhood discovery must not require login by default.',
);

// v3.1 notification expiration stays provider-neutral.
const { isExpiredNotification } = await import(
  '../src/notifications/notificationEnvelope.js'
);
assert(
  isExpiredNotification(
    {
      id: 'n-expired',
      category: 'local_change',
      title: 'Cambio',
      occurredAt: '2026-09-16T10:00:00Z',
      expiresAt: '2026-09-16T11:00:00Z',
    },
    '2026-09-16T12:00:00Z',
  ) === true,
  'Expired notifications must be suppressible independent of transport provider.',
);

console.log('PASS: palta-app v3.1 auth/access/notification tests');


// v3.2 events, assets, releases and cost guards stay provider-neutral.
const {
  shouldDedupeEvents,
  eventAffectsSubject,
} = await import('../src/events/eventPolicy.js');

const eventA = {
  id: 'e1',
  type: 'care.updated' as const,
  occurredAt: '2026-09-16T12:00:00Z',
  source: 'palta-care',
  subjectRef: 'care-1',
  dedupeKey: 'care-1:wait',
  payload: {},
};
const eventB = {
  ...eventA,
  id: 'e2',
};
assert(
  shouldDedupeEvents(eventA, eventB) === true &&
    eventAffectsSubject(eventA, 'care-1') === true,
  'Event Core must support provider-neutral dedupe/subject targeting.',
);

const { isProviderNeutralAssetRef } = await import(
  '../src/assets/assetRef.js'
);
assert(
  isProviderNeutralAssetRef({
    assetId: 'asset-1',
    kind: 'map_release',
    logicalKey: 'maps/cl/santiago/v1.pmtiles',
  }) === true,
  'Logical asset identity should not encode a storage vendor.',
);
assert(
  isProviderNeutralAssetRef({
    assetId: 'asset-2',
    kind: 'map_release',
    logicalKey: 'cloudflare-r2/maps/file.pmtiles',
  }) === false,
  'Vendor-specific storage naming must be detectable.',
);

const { validateReleaseManifest } = await import(
  '../src/releases/releaseManifest.js'
);
const releaseErrors = validateReleaseManifest({
  releaseId: 'local-places-cl-scl-2026-09-16',
  dataset: 'local-places',
  country: 'CL',
  createdAt: '2026-09-16T12:00:00Z',
  schemaVersion: '1',
  files: [
    {
      logicalKey: 'local-places.json',
      sha256: 'a'.repeat(64),
      bytes: 1024,
    },
  ],
});
assert(
  releaseErrors.length === 0,
  'Valid release manifest should pass independently of storage location.',
);

const { classifyProviderUsage } = await import(
  '../src/cost/providerCostGuard.js'
);
assert(
  classifyProviderUsage({
    provider: 'example',
    metric: 'requests',
    freeLimit: 100,
    currentUsage: 86,
  }) === 'optimize_85',
  'Cost guard should trigger optimization before the free limit is exhausted.',
);

console.log('PASS: palta-app v3.2 data/event independence tests');


// v3.4 UI/accessibility semantics.
const {
  clampTouchTarget,
  shouldAnimate,
} = await import('../src/ui/interactionSemantics.js');

assert(
  clampTouchTarget(30) === 44 &&
    clampTouchTarget(60) === 60,
  'Touch targets must never shrink below the accessibility minimum.',
);
assert(
  shouldAnimate('reduced', 'decoration') === false &&
    shouldAnimate('reduced', 'feedback') === true,
  'Reduced Motion must suppress decoration while retaining essential feedback.',
);

const { decideHomeDensity } = await import(
  '../src/ui/contentDensity.js'
);

assert(
  decideHomeDensity({
    actionCount: 4,
    statusCount: 2,
    usefulTodayCount: 0,
    discoveryCount: 5,
  }).maxDiscoveryCards === 0,
  'Busy Home must suppress discovery filler.',
);
const quietDensity = decideHomeDensity({
  actionCount: 0,
  statusCount: 0,
  usefulTodayCount: 1,
  discoveryCount: 5,
});
assert(
  quietDensity.maxDiscoveryCards === 2,
  'Quiet Home may show useful discovery but must remain capped.',
);

const { resolveBusinessActions } = await import(
  '../src/business/businessActionPolicy.js'
);
const unverifiedActions = resolveBusinessActions({
  capabilities: ['coupon', 'quote', 'whatsapp', 'save'],
  verificationStatus: 'unverified',
});
assert(
  unverifiedActions[0]?.capability === 'quote',
  'Business primary action should follow user utility.',
);
assert(
  unverifiedActions.find((item) => item.capability === 'coupon')?.enabled === false,
  'Unverified business must not publish controlled coupon actions.',
);

const {
  buildCareTimeline,
  careStateLabel,
} = await import('../src/care/careTimeline.js');
const waitTimeline = buildCareTimeline('wait');
assert(
  waitTimeline.find((step) => step.state === 'wait')?.status === 'current' &&
    waitTimeline.find((step) => step.state === 'result')?.status === 'upcoming',
  'Care timeline must preserve Wait → Result → Follow-up → Outcome order.',
);
assert(
  careStateLabel('wait', 'ko-KR') === '기다리는 중',
  'Care presentation may localize without changing state identity.',
);

const {
  preferredResultSheetSnap,
  nextSheetSnap,
} = await import('../src/neighborhood/resultSheetPolicy.js');
assert(
  preferredResultSheetSnap({
    resultCount: 8,
    selectedEntityId: null,
    keyboardOpen: false,
  }) === 'half',
  'Map/result browsing should default to balanced map/list context.',
);
assert(
  nextSheetSnap('half', 'up') === 'full' &&
    nextSheetSnap('half', 'down') === 'peek',
  'Result sheet snap transitions must be deterministic.',
);

console.log('PASS: palta-app v3.4 UI/UX policy tests');


// v3.5 Home display selection applies the density rule to real API-shaped items.
const { selectHomeDisplayItems } = await import(
  '../src/home/selectHomeDisplayItems.js'
);

const selectedQuietHome = selectHomeDisplayItems([
  {
    id: 'useful-1',
    kind: 'useful_today',
    title: 'Clima',
    source_domain: 'weather',
    delivery: 'home',
  },
  {
    id: 'content-1',
    kind: 'content',
    title: 'Noticia 1',
    source_domain: 'news',
    delivery: 'home',
  },
  {
    id: 'content-2',
    kind: 'content',
    title: 'Noticia 2',
    source_domain: 'news',
    delivery: 'home',
  },
  {
    id: 'content-3',
    kind: 'content',
    title: 'Noticia 3',
    source_domain: 'news',
    delivery: 'home',
  },
]);

assert(
  selectedQuietHome.items.filter((item) => item.kind === 'content').length === 2,
  'Quiet Home must cap discovery instead of filling every available card.',
);

const selectedBusyHome = selectHomeDisplayItems([
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `action-${index}`,
    kind: 'action' as const,
    title: `Action ${index}`,
    source_domain: 'care',
    delivery: 'home' as const,
  })),
  {
    id: 'content-busy',
    kind: 'content' as const,
    title: 'News',
    source_domain: 'news',
    delivery: 'home' as const,
  },
]);

assert(
  selectedBusyHome.items.every((item) => item.kind !== 'content'),
  'Busy Home must suppress discovery cards completely.',
);

console.log('PASS: palta-app v3.5 screen integration policy tests');


// v3.6 Community trust boundaries.
const {
  canOpenCommunitySurface,
  canPubliclyDiscoverCommunity,
} = await import('../src/community/trustScopePolicy.js');

const schoolGroup = {
  key: 'school-class-4a',
  title: '4A',
  scope: 'member_group' as const,
  requiresMembership: true,
  canAppearInPublicDiscovery: false,
};
assert(
  canOpenCommunitySurface({
    surface: schoolGroup,
    isSignedIn: true,
    isMember: true,
  }) === true,
  'Member group should open for an authenticated member.',
);
assert(
  canOpenCommunitySurface({
    surface: schoolGroup,
    isSignedIn: true,
    isMember: false,
  }) === false &&
    canPubliclyDiscoverCommunity(schoolGroup) === false,
  'Private/member group must not leak into public discovery.',
);

// v3.6 Market keeps create contextual.
const {
  marketVerticalByKey,
  marketVerticals,
} = await import('../src/market/marketVerticalPolicy.js');
assert(
  marketVerticals.length === 4 &&
    marketVerticalByKey('property').mapUseful === true &&
    marketVerticalByKey('secondhand').createContextual === true,
  'Market must expose four initial verticals with contextual create.',
);

// v3.6 Context Space requires a real confirmed situation.
const { shouldPromoteContextSpace } = await import(
  '../src/play/contextSpacePolicy.js'
);
assert(
  shouldPromoteContextSpace({
    hasConfirmedAction: false,
    hasSavedOnly: true,
    hasDateOrActiveState: true,
  }) === false,
  'Saved browsing alone must not create a life Context Space.',
);
assert(
  shouldPromoteContextSpace({
    hasConfirmedAction: true,
    hasSavedOnly: false,
    hasDateOrActiveState: true,
  }) === true,
  'Confirmed dated/active situation may create a Context Space.',
);

console.log('PASS: palta-app v3.6 secondary surface tests');


// v3.7 presentation priority.
const {
  decidePresentation,
  priorityScore,
} = await import('../src/experience/presentationPriority.js');

const weatherPresentation = decidePresentation({
  urgency: 0,
  relevance: 2,
  actionRequired: 0,
  risk: 0,
  freshness: 2,
  frequency: 3,
});
assert(
  weatherPresentation.preferredSurface === 'glance_cluster',
  'Routine frequent low-risk information should be glanceable.',
);

const urgentCarePresentation = decidePresentation({
  urgency: 3,
  relevance: 3,
  actionRequired: 3,
  risk: 2,
  freshness: 3,
  frequency: 1,
});
assert(
  urgentCarePresentation.tier === 'focus' &&
    urgentCarePresentation.mayHideFromInitialViewport === false,
  'Urgent required action must remain visible.',
);

assert(
  priorityScore({
    urgency: 3,
    relevance: 3,
    actionRequired: 3,
    risk: 3,
    freshness: 0,
    frequency: 0,
  }) >
    priorityScore({
      urgency: 0,
      relevance: 1,
      actionRequired: 0,
      risk: 0,
      freshness: 3,
      frequency: 3,
    }),
  'Risk/action/urgency must dominate freshness/frequency.',
);

// v3.7 adaptive text layout.
const {
  classifyTextScale,
  focusLayoutPolicy,
} = await import('../src/accessibility/focusLayout.js');

assert(
  classifyTextScale(1) === 'normal' &&
    classifyTextScale(1.4) === 'large' &&
    classifyTextScale(2) === 'accessibility',
  'Text scale classification must be deterministic.',
);
assert(
  focusLayoutPolicy(2).columns === 1 &&
    focusLayoutPolicy(2).maxInitialGlanceItems === 2 &&
    focusLayoutPolicy(2).preferTextLabelsOverIconOnly === true,
  'Accessibility text must reprioritize and reflow rather than merely scale.',
);

// v3.7 haptics.
const { hapticIntentForEvent } = await import(
  '../src/haptics/hapticIntent.js'
);
assert(
  hapticIntentForEvent('navigate') === 'none' &&
    hapticIntentForEvent('server_action_succeeded') === 'success' &&
    hapticIntentForEvent('offline_queued') === 'none',
  'Haptics must represent meaningful state outcomes, not ordinary taps or queued work.',
);

// v3.7 reading.
const {
  speechSequence,
  clampReadingProgress,
} = await import('../src/reading/readingExperience.js');

const spoken = speechSequence([
  { kind: 'heading', text: 'Título', locale: 'es-CL' },
  { kind: 'paragraph', text: 'Contenido.', locale: 'es-CL' },
  { kind: 'source', text: 'Fuente oficial', locale: 'es-CL' },
]);
assert(
  spoken.length === 3,
  'Reading speech sequence should preserve semantic reading blocks.',
);

const clamped = clampReadingProgress(
  {
    contentId: 'article-1',
    blockIndex: 10,
    characterOffset: -5,
    mode: 'listen',
  },
  3,
);
assert(
  clamped.blockIndex === 2 && clamped.characterOffset === 0,
  'Reading progress must remain within semantic content bounds.',
);

console.log('PASS: palta-app v3.7 experience system tests');


// v3.8 reference-layout invariants are backed by the same core policy.
const {
  focusLayoutPolicy: focusPolicyV38,
} = await import('../src/accessibility/focusLayout.js');

const normalReferencePolicy = focusPolicyV38(1);
const largeReferencePolicy = focusPolicyV38(1.35);
const accessibilityReferencePolicy = focusPolicyV38(1.9);

assert(
  normalReferencePolicy.maxInitialGlanceItems >
    accessibilityReferencePolicy.maxInitialGlanceItems,
  'Accessibility Home must reduce initial glance density.',
);
assert(
  largeReferencePolicy.allowHorizontalMetadataCompression === false,
  'Large-text layouts must stop forcing horizontal metadata compression.',
);
assert(
  accessibilityReferencePolicy.preferFullHeightSheet === true,
  'Accessibility layouts should prefer larger readable sheet geometry.',
);

console.log('PASS: palta-app v3.8 reference UI policy tests');


// v3.9 ports remain provider-neutral contracts.
const hapticsPortSource = await import('../src/ports/hapticsPort.js');
const speechPortSource = await import('../src/ports/speechPort.js');
assert(
  typeof hapticsPortSource === 'object' &&
    typeof speechPortSource === 'object',
  'Haptics/Speech provider-neutral port modules must compile.',
);

console.log('PASS: palta-app v3.9 feedback-port tests');


// v4.0 payment/commerce extensibility tests.
const {
  PaymentRouter,
} = await import('../src/payment/paymentRouter.js');
const {
  canAcceptPayment,
} = await import('../src/payment/merchantPaymentConnection.js');
const {
  orderStatusAfterPayment,
} = await import('../src/payment/paymentPolicy.js');
const {
  InMemoryTransactionLedger,
} = await import('../src/payment/transactionLedger.js');

const fakeProviderA = {
  providerKey: 'provider_a',
  supportsRail: (rail: 'card' | 'wallet' | 'account_to_account' | 'cash' | 'other') =>
    rail === 'card',
  createPayment: async () => ({
    providerKey: 'provider_a',
    providerReference: 'A-1',
    status: 'pending' as const,
  }),
  getStatus: async () => ({
    providerKey: 'provider_a',
    providerReference: 'A-1',
    status: 'paid' as const,
  }),
  refund: async () => ({
    providerKey: 'provider_a',
    providerReference: 'A-1',
    status: 'refunded' as const,
  }),
};

const fakeProviderB = {
  providerKey: 'provider_b',
  supportsRail: (rail: 'card' | 'wallet' | 'account_to_account' | 'cash' | 'other') =>
    rail === 'account_to_account',
  createPayment: async () => ({
    providerKey: 'provider_b',
    providerReference: 'B-1',
    status: 'pending' as const,
  }),
  getStatus: async () => ({
    providerKey: 'provider_b',
    providerReference: 'B-1',
    status: 'paid' as const,
  }),
  refund: async () => ({
    providerKey: 'provider_b',
    providerReference: 'B-1',
    status: 'refunded' as const,
  }),
};

const paymentRouter = new PaymentRouter([fakeProviderA, fakeProviderB]);
assert(
  paymentRouter.select({ rail: 'card' }).providerKey === 'provider_a',
  'Card payment should route through a provider that supports card rail.',
);
assert(
  paymentRouter.select({ rail: 'account_to_account' }).providerKey ===
    'provider_b',
  'Account-to-account payment should be routable without changing canonical payment models.',
);

assert(
  canAcceptPayment({
    id: 'mc-1',
    merchantId: 'merchant-1',
    providerKey: 'provider_a',
    status: 'connected',
    capabilities: {
      receivePayments: true,
      refunds: true,
      splitFees: false,
      settlements: true,
      accountToAccount: false,
    },
    updatedAt: '2026-09-16T00:00:00Z',
  }) === true,
  'Connected merchant with receive capability should accept payments.',
);

assert(
  orderStatusAfterPayment('awaiting_payment', 'paid') === 'paid',
  'Order state should advance from awaiting_payment to paid on canonical payment success.',
);

const ledger = new InMemoryTransactionLedger();
ledger.append({
  id: 'evt-1',
  paymentIntentId: 'pay-1',
  type: 'payment_created',
  occurredAt: '2026-09-16T00:00:00Z',
});
ledger.append({
  id: 'evt-2',
  paymentIntentId: 'pay-1',
  type: 'payment_paid',
  occurredAt: '2026-09-16T00:00:02Z',
});
assert(
  ledger.listForPayment('pay-1').length === 2 &&
    ledger.hasTerminalEvent('pay-1') === true,
  'Transaction history must retain canonical payment events.',
);

console.log('PASS: palta-app v4.0 payment/commerce extensibility tests');


// v4.1 security/privacy tests.
const {
  authorize,
} = await import('../src/security/authorization.js');
const {
  roleAllows,
} = await import('../src/security/businessRoles.js');
const {
  mayExistOnClient,
} = await import('../src/security/secretsPolicy.js');
const {
  ReplayGuard,
} = await import('../src/security/webhookVerification.js');
const {
  assessAbuse,
} = await import('../src/security/abusePolicy.js');
const {
  minimumLocationPrecision,
} = await import('../src/privacy/minimization.js');
const {
  handlingRule,
} = await import('../src/privacy/dataClassification.js');

assert(
  authorize({
    principalId: 'user-1',
    principalKind: 'user',
    resourceOwnerId: 'user-1',
    resourceScope: 'self',
    action: 'read',
  }).allow === true,
  'Users should be able to read their own self-scoped data.',
);

assert(
  authorize({
    principalId: 'operator-1',
    principalKind: 'palta_operator',
    resourceOwnerId: 'user-1',
    resourceScope: 'self',
    action: 'read',
  }).allow === false,
  'Palta operators must not have ambient access to self-scoped personal data.',
);

assert(
  roleAllows('kitchen', 'order_prepare') === true &&
    roleAllows('kitchen', 'refund_create') === false &&
    roleAllows('cashier', 'staff_manage') === false,
  'Business capabilities must enforce least privilege.',
);

assert(
  mayExistOnClient('service_role_key') === false &&
    mayExistOnClient('webhook_secret') === false &&
    mayExistOnClient('provider_access_token') === false,
  'Privileged secrets must never be allowed on clients.',
);

const replayGuard = new ReplayGuard(60_000);
assert(
  replayGuard.accept('provider-event-1', 1_000) === true &&
    replayGuard.accept('provider-event-1', 2_000) === false &&
    replayGuard.accept('provider-event-1', 70_000) === true,
  'Webhook replay protection must reject duplicates during the replay window.',
);

assert(
  assessAbuse({
    repeatedFailedAuth: 0,
    rapidOrderAttempts: 0,
    refundBurst: 0,
    qrReuseAcrossDistantLocations: 0,
    repeatedExportAttempts: 0,
  }) === 'allow',
  'Normal behavior should not be challenged.',
);

assert(
  assessAbuse({
    repeatedFailedAuth: 25,
    rapidOrderAttempts: 0,
    refundBurst: 0,
    qrReuseAcrossDistantLocations: 0,
    repeatedExportAttempts: 0,
  }) === 'block_and_review',
  'Severe authentication abuse should be blocked and reviewed.',
);

assert(
  minimumLocationPrecision('analytics') === 'city' &&
    minimumLocationPrecision('eligibility') === 'commune',
  'Location collection must use the minimum precision required.',
);

assert(
  handlingRule('sensitive_personal').clientCacheAllowed === false &&
    handlingRule('payment_restricted').analyticsAllowed === false,
  'Sensitive/payment data must not flow into general client cache or analytics.',
);

console.log('PASS: palta-app v4.1 security/privacy foundation tests');


// v4.2 life-event exposure guidance tests.
const {
  evaluateLifeEvent,
} = await import('../src/lifeEvents/exposureEngine.js');
const {
  defaultLifeEventRules,
} = await import('../src/lifeEvents/playbooks/index.js');
const {
  bridgeForRisk,
} = await import('../src/lifeEvents/actionBridge.js');

const unknownVehicleContext = {
  eventType: 'vehicle_stolen',
  knownFacts: {},
  confirmedFacts: {},
};

const unknownVehicleGuidance = evaluateLifeEvent(
  unknownVehicleContext,
  defaultLifeEventRules,
);

const homeAccessPrompt = [
  ...unknownVehicleGuidance.immediate,
  ...unknownVehicleGuidance.today,
].find((risk) => risk.id === 'home_access_exposure');

assert(
  homeAccessPrompt?.evidence === 'common_risk_prompt' &&
    homeAccessPrompt?.actionability === 'user_must_confirm' &&
    typeof homeAccessPrompt?.confirmQuestion === 'string',
  'Unknown downstream exposure must be presented as a prompt, not asserted as fact.',
);

const confirmedVehicleGuidance = evaluateLifeEvent(
  {
    eventType: 'vehicle_stolen',
    knownFacts: {},
    confirmedFacts: {
      hasHomeAccessRemoteInVehicle: true,
    },
  },
  defaultLifeEventRules,
);

const confirmedHomeAccess = [
  ...confirmedVehicleGuidance.immediate,
  ...confirmedVehicleGuidance.today,
].find((risk) => risk.id === 'home_access_exposure');

assert(
  confirmedHomeAccess?.evidence === 'user_confirmed' &&
    confirmedHomeAccess?.actionability === 'user_must_do',
  'Confirmed exposure should escalate from check to concrete user action.',
);

const phoneGuidance = evaluateLifeEvent(
  {
    eventType: 'phone_lost',
    knownFacts: {},
    confirmedFacts: {},
  },
  defaultLifeEventRules,
);

const paltaSessionRisk = phoneGuidance.immediate.find(
  (risk) => risk.id === 'palta_session_revoke',
);

assert(
  paltaSessionRisk &&
    bridgeForRisk(paltaSessionRisk).kind === 'direct',
  'When Palta can act directly, the guidance engine should expose a direct action bridge.',
);

console.log('PASS: palta-app v4.2 life-event exposure guidance tests');


// v4.3 service exchange / partner core tests.
const {
  routeProviders,
} = await import('../src/serviceExchange/providerRouting.js');
const {
  validateListingPresentation,
} = await import('../src/serviceExchange/competitionPolicy.js');
const {
  validateRevenueRule,
} = await import('../src/serviceExchange/revenueModel.js');
const {
  supportsPartnerCapability,
} = await import('../src/partners/partnerCapability.js');
const {
  mayUpgradePartnerConnection,
} = await import('../src/partners/partnerProgression.js');

const routedProviders = routeProviders(
  {
    categoryId: 'vehicle_repair',
    serviceAreaId: 'vitacura',
    maxProviders: 2,
    providerIdsSeenRecently: ['p1'],
  },
  [
    {
      providerId: 'p1',
      businessId: 'b1',
      categoryIds: ['vehicle_repair'],
      serviceAreaIds: ['vitacura'],
      verified: true,
      distanceRank: 0,
      responseQualityRank: 0,
      availabilityRank: 0,
    },
    {
      providerId: 'p2',
      businessId: 'b2',
      categoryIds: ['vehicle_repair'],
      serviceAreaIds: ['vitacura'],
      verified: true,
      distanceRank: 1,
      responseQualityRank: 1,
      availabilityRank: 0,
    },
    {
      providerId: 'p3',
      businessId: 'b3',
      categoryIds: ['locksmith'],
      serviceAreaIds: ['vitacura'],
      verified: true,
    },
  ],
);

assert(
  routedProviders.length === 2 &&
    routedProviders.every((provider) =>
      provider.categoryIds.includes('vehicle_repair'),
    ),
  'Quote routing must stay inside the requested service category and service area.',
);

assert(
  validateListingPresentation({
    providerId: 'paid-1',
    promotionLabel: 'sponsored',
    canEnterOrganicQuotePool: true,
  }).valid === false,
  'Sponsored placement must not silently enter the organic quote pool.',
);

assert(
  validateRevenueRule({
    mechanism: 'partner_revenue_share',
    enabled: true,
    userVisibleDisclosureRequired: true,
    affectsOrganicRanking: true,
  }).valid === false,
  'Commercial compensation must not secretly distort organic routing.',
);

const partnerConnection = {
  id: 'conn-1',
  partnerId: 'insurer-1',
  category: 'insurance',
  level: 'structured_exchange' as const,
  capabilities: ['information', 'status', 'document'] as const,
  enabled: true,
};

assert(
  supportsPartnerCapability(partnerConnection, 'status') === true &&
    supportsPartnerCapability(partnerConnection, 'payment') === false,
  'Partner capabilities must be explicit rather than inferred from partner category.',
);

assert(
  mayUpgradePartnerConnection({
    current: 'information_only',
    target: 'transactional_api',
    requestedCapabilities: ['information', 'claim', 'status'],
  }) === true &&
    mayUpgradePartnerConnection({
      current: 'structured_exchange',
      target: 'information_only',
      requestedCapabilities: ['information'],
    }) === false,
  'Partner integrations should support progressive upgrades without accidental capability downgrade.',
);

console.log('PASS: palta-app v4.3 service exchange / partner core tests');
