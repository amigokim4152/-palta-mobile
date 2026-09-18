import {
  findProductionPlace,
  placeToLocalSearchItem,
  searchProductionPlaces,
  type LocalPlaceSnapshot,
} from '../src/local/localPlaceSnapshot.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const snapshot: LocalPlaceSnapshot = {
  schema_version: 'palta-local-place-mobile-api.v1',
  dataset_class: 'production',
  items: [
    {
      id: 'school-1',
      record_class: 'production',
      entity_type: 'place',
      place_type: 'school',
      name: 'Colegio Real',
      category_key: 'education:school',
      public_listing_status: 'active_public_listing',
      map_eligible: true,
      location: { lat: -33.381, lng: -70.571 },
      address: 'Av. Luis Pasteur 6076',
      commune: 'Vitacura',
      fact_verification_status: 'public_source_corroborated',
    },
    {
      id: 'sample-school',
      record_class: 'sample',
      entity_type: 'place',
      name: 'Colegio ejemplo',
      map_eligible: true,
      location: { lat: -33.381, lng: -70.571 },
    },
  ],
};

const results = searchProductionPlaces(snapshot, {
  latitude: -33.3842,
  longitude: -70.5742,
  radiusM: 5000,
});
assert(results.length === 1, 'Only production places may enter local search.');
assert(results[0]?.id === 'school-1', 'Canonical Local Place ID must be preserved.');

const local = placeToLocalSearchItem(results[0]!);
assert(local.entity_id === 'school-1', 'Local search must expose canonical place ID.');
assert(local.entity_type === 'place', 'Schools must remain Local Places, not businesses.');
assert(local.record_class === 'production', 'Local search must retain production class.');

assert(findProductionPlace(snapshot, 'school-1')?.place_type === 'school', 'Place detail lookup must resolve.');
assert(findProductionPlace(snapshot, 'sample-school') === undefined, 'Sample places must never resolve through production detail lookup.');

const filtered = searchProductionPlaces(snapshot, {
  latitude: -33.3842,
  longitude: -70.5742,
  radiusM: 5000,
  query: 'colegio',
});
assert(filtered.length === 1, 'Place search should match public name/category text.');

console.log('local-place snapshot tests: ok');
