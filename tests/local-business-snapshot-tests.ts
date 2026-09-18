import {
  findProductionBusiness,
  searchProductionBusinesses,
  toLocalSearchItem,
  type BusinessSnapshot,
} from '../src/local/businessSnapshot.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const snapshot: BusinessSnapshot = {
  schema_version: 'palta-business-mobile-api.v1',
  items: [
    {
      id: 'prod-1',
      entity_type: 'business',
      name: 'Café Real',
      category_key: 'cafe',
      record_class: 'production',
      public_listing_status: 'active_public_listing',
      map_eligible: true,
      location: { lat: -33.38, lng: -70.57 },
      address: 'Av. Luis Pasteur 6000',
      commune: 'Vitacura',
      verification_status: 'unverified',
      fact_verification_status: 'public_source_corroborated',
      owner_verification_status: 'unverified',
    },
    {
      id: 'sample-1',
      entity_type: 'business',
      name: 'Negocio ejemplo',
      record_class: 'sample',
      map_eligible: true,
      location: { lat: -33.38, lng: -70.57 },
    },
    {
      id: 'candidate-1',
      entity_type: 'business',
      name: 'Candidato OSM',
      record_class: 'discovery_candidate',
      map_eligible: false,
      location: { lat: -33.38, lng: -70.57 },
    },
  ],
};

const results = searchProductionBusinesses(snapshot, {
  latitude: -33.38,
  longitude: -70.57,
  radiusM: 2000,
});
assert(results.length === 1, 'Only production businesses may enter local search.');
assert(results[0]?.id === 'prod-1', 'Production canonical ID must be preserved.');

const local = toLocalSearchItem(results[0]!);
assert(local.entity_id === 'prod-1', 'Local search must expose the canonical Business ID.');
assert(local.record_class === 'production', 'Local search must explicitly retain production class.');

assert(findProductionBusiness(snapshot, 'prod-1')?.name === 'Café Real', 'Production detail lookup must resolve.');
assert(findProductionBusiness(snapshot, 'sample-1') === undefined, 'Sample fixtures must never resolve through production detail lookup.');
assert(findProductionBusiness(snapshot, 'candidate-1') === undefined, 'Discovery candidates must never resolve through production detail lookup.');

const filtered = searchProductionBusinesses(snapshot, {
  latitude: -33.38,
  longitude: -70.57,
  radiusM: 2000,
  query: 'pasteur',
});
assert(filtered.length === 1, 'Search should match canonical public address text.');

console.log('local-business snapshot tests: ok');
