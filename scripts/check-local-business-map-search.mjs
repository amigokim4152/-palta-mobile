import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const reducerPath = path.join(root, 'mobile-overlay/src/features/neighborhood/reduceNeighborhood.ts');
const businessDiscoveryPath = path.join(root, 'mobile-overlay/src/features/business/BusinessDiscoveryExperience.tsx');
const neighborhoodPath = path.join(root, 'mobile-overlay/src/features/neighborhood/NeighborhoodScreen.tsx');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of [reducerPath, businessDiscoveryPath, neighborhoodPath]) {
  assert(fs.existsSync(file), `Missing map-search contract source: ${path.relative(root, file)}`);
}

const reducer = fs.readFileSync(reducerPath, 'utf8');
const discovery = fs.readFileSync(businessDiscoveryPath, 'utf8');
const neighborhood = fs.readFileSync(neighborhoodPath, 'utf8');

assert(
  reducer.includes('searchOrigin: state.camera?.center ?? state.effectiveLocation'),
  'Buscar en esta zona must move the canonical search origin to the current camera center.',
);
assert(
  reducer.includes('resultIds: []') && !reducer.includes('resultIds: action.resultIds'),
  'A viewport search must clear stale result ownership instead of assigning the previous result set to the new map area.',
);
assert(
  discovery.includes('latitude: searchPoint.latitude') &&
    discovery.includes('longitude: searchPoint.longitude') &&
    discovery.includes('mobileRuntime.client.searchLocal'),
  'Negocios must re-query the canonical Local Search API from the updated search point.',
);
assert(
  neighborhood.includes('latitude: searchPoint.latitude') &&
    neighborhood.includes('longitude: searchPoint.longitude') &&
    neighborhood.includes('mobileRuntime.client.searchLocal'),
  'The shared neighborhood surface must use the same camera-center search contract.',
);
assert(
  discovery.includes("type: 'search_current_viewport'") &&
    neighborhood.includes("type: 'search_current_viewport'"),
  'Both map surfaces must dispatch the canonical viewport-search action.',
);

console.log('PASS: Local Business camera-center viewport search contract');
