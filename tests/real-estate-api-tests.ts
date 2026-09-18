import {
  RealEstateApiClient,
  RealEstateApiError,
} from '../src/api/realEstateApiClient.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const requests: Array<{
  url: string;
  headers?: Record<string, string>;
}> = [];

const apiItem = {
  listing_id: 'listing-1',
  property_id: 'property-1',
  transaction_type: 'rent' as const,
  property_type: 'apartment' as const,
  publisher_type: 'owner_direct' as const,
  publisher_label: 'Dueño directo',
  publisher_user_id: 'user-1',
  price_clp: 780000,
  common_expenses_clp: 98000,
  published_at: '2026-09-18T09:00:00-03:00',
  status: 'active' as const,
  comuna: 'Providencia',
  sector: 'Pedro de Valdivia',
  display_address: 'Providencia, Región Metropolitana',
  latitude: -33.4311,
  longitude: -70.6104,
  bedrooms: 2,
  bathrooms: 2,
  parking_spaces: 1,
  usable_area_m2: 68,
  total_area_m2: 74,
};

const contextPayload = {
  property_id: 'property-1',
  generated_at: '2026-09-18T12:00:00Z',
  building: {
    building_id: 'building-1',
    name: 'Edificio Uno',
    place_id: 'place-building-1',
    year_built: 2018,
    floors: 12,
    unit_count: 48,
    evidence: {
      verification: 'corroborated' as const,
      source_id: 'building-registry:1',
    },
  },
  nearby: [
    {
      kind: 'transit' as const,
      source_core: 'transport' as const,
      entity_id: 'metro-1',
      place_id: 'place-metro-1',
      display_label: 'Metro cercano',
      distance_meters: 420,
      walking_minutes: 6,
      evidence: {
        verification: 'verified' as const,
        source_id: 'transport-core',
      },
    },
  ],
};

const client = new RealEstateApiClient({
  baseUrl: 'https://api.somospalta.cl/',
  getAccessToken: async () => 'token-real-estate',
  fetch: async (url, init) => {
    requests.push({
      url,
      ...(init?.headers ? { headers: init.headers } : {}),
    });
    return {
      ok: true,
      status: 200,
      async json() {
        if (url.includes('/v1/real-estate/listings?')) {
          return { generated_at: '2026-09-18T12:00:00Z', items: [apiItem] };
        }
        if (url.includes('/v1/real-estate/properties/')) return contextPayload;
        return apiItem;
      },
    };
  },
});

const search = await client.searchListings({
  text: 'Providencia',
  transactionType: 'rent',
  propertyType: 'apartment',
  publisherType: 'owner_direct',
  maxPriceClp: 800000,
  minUsableAreaM2: 60,
  minBedrooms: 2,
  minParkingSpaces: 1,
});
assert(search.items[0]?.listing_id === 'listing-1', 'Real-estate API search must validate and return listing DTOs.');
const searchUrl = requests[0]?.url ?? '';
assert(searchUrl.includes('/v1/real-estate/listings?'), 'Real-estate search must call the canonical listing endpoint.');
assert(searchUrl.includes('q=Providencia'), 'Search text must serialize to q.');
assert(searchUrl.includes('transaction=rent'), 'Transaction type must serialize.');
assert(searchUrl.includes('propertyType=apartment'), 'Property type must serialize.');
assert(searchUrl.includes('publisher=owner_direct'), 'Publisher type must serialize to the canonical publisher key.');
assert(searchUrl.includes('maxPriceClp=800000'), 'CLP price filters must serialize.');
assert(searchUrl.includes('minArea=60'), 'Usable-area filters must serialize to the canonical area key.');
assert(searchUrl.includes('minBedrooms=2'), 'Bedroom filters must serialize.');
assert(searchUrl.includes('minParking=1'), 'Parking filters must serialize to the canonical parking key.');
assert(
  requests[0]?.headers?.Authorization === 'Bearer token-real-estate',
  'Real-estate API requests must carry the current Palta access token.',
);

const detail = await client.getListing('listing-1');
assert(detail.property_id === 'property-1', 'Real-estate detail must validate the canonical listing DTO.');
assert(
  requests[1]?.url.endsWith('/v1/real-estate/listings/listing-1') === true,
  'Real-estate detail must encode and call the canonical listing id route.',
);

const context = await client.getPropertyContext('property-1');
assert(context.building?.building_id === 'building-1', 'Property context must validate canonical Building identity.');
assert(
  context.nearby[0]?.source_core === 'transport' && context.nearby[0]?.entity_id === 'metro-1',
  'Property context must validate source-core nearby references.',
);
assert(
  requests[2]?.url.endsWith('/v1/real-estate/properties/property-1/context') === true,
  'Property context must use the canonical property context route.',
);
assert(
  requests[2]?.headers?.Authorization === 'Bearer token-real-estate',
  'Property context requests must use the same authenticated Palta client boundary.',
);

const missingClient = new RealEstateApiClient({
  baseUrl: 'https://api.somospalta.cl',
  fetch: async () => ({
    ok: false,
    status: 404,
    async json() { return { error: 'real_estate_listing_not_found' }; },
  }),
});
let missingStatus = 0;
try {
  await missingClient.getListing('missing');
} catch (error) {
  if (error instanceof RealEstateApiError) missingStatus = error.status;
}
assert(missingStatus === 404, 'Real-estate API must preserve HTTP 404 as a typed status error.');

const invalidClient = new RealEstateApiClient({
  baseUrl: 'https://api.somospalta.cl',
  fetch: async () => ({
    ok: true,
    status: 200,
    async json() { return { items: [{ listing_id: 'broken' }] }; },
  }),
});
let invalidRejected = false;
try {
  await invalidClient.searchListings({});
} catch {
  invalidRejected = true;
}
assert(invalidRejected, 'Malformed real-estate API payloads must be rejected instead of entering the UI model.');

let invalidContextRejected = false;
try {
  await new RealEstateApiClient({
    baseUrl: 'https://api.somospalta.cl',
    fetch: async () => ({
      ok: true,
      status: 200,
      async json() { return { property_id: 'property-1', nearby: [{ entity_id: 'broken' }] }; },
    }),
  }).getPropertyContext('property-1');
} catch {
  invalidContextRejected = true;
}
assert(invalidContextRejected, 'Malformed property-context payloads must be rejected before entering the UI model.');

console.log('PASS: real-estate API client query, auth, context, validation and status contracts');
