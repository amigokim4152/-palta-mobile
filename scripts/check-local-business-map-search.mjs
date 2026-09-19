import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const reducerPath = path.join(root, 'mobile-overlay/src/features/neighborhood/reduceNeighborhood.ts');
const businessDiscoveryPath = path.join(root, 'mobile-overlay/src/features/business/BusinessDiscoveryExperience.tsx');
const neighborhoodPath = path.join(root, 'mobile-overlay/src/features/neighborhood/NeighborhoodScreen.tsx');
const mapPath = path.join(root, 'mobile-overlay/src/components/map/NeighborhoodMap.tsx');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const file of [reducerPath, businessDiscoveryPath, neighborhoodPath, mapPath]) {
  assert(fs.existsSync(file), `Missing map-search contract source: ${path.relative(root, file)}`);
}

const reducer = fs.readFileSync(reducerPath, 'utf8');
const discovery = fs.readFileSync(businessDiscoveryPath, 'utf8');
const neighborhood = fs.readFileSync(neighborhoodPath, 'utf8');
const map = fs.readFileSync(mapPath, 'utf8');

// Exercise the actual reducer so a location update cannot leave the previous
// search origin or selected business attached to the newly centered map.
const reducerModule = ts.transpileModule(reducer, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { reduceNeighborhood } = await import(`data:text/javascript,${encodeURIComponent(reducerModule)}`);
const vitacura = { latitude: -33.3908, longitude: -70.5707 };
const previous = {
  effectiveLocation: { latitude: -33.4489, longitude: -70.6693 },
  searchOrigin: { latitude: -33.4489, longitude: -70.6693 },
  camera: { center: { latitude: -33.4489, longitude: -70.6693 }, zoom: 12.4 },
  selectedEntityId: 'old-business',
  mapMovedSinceSearch: true,
  resultIds: ['old-business'],
};
const recentered = reduceNeighborhood(previous, { type: 'set_effective_location', location: vitacura });
assert(recentered.effectiveLocation === vitacura && recentered.searchOrigin === vitacura,
  'Mi ubicación must update both the effective location and Local Search origin.');
assert(recentered.camera.center === vitacura && recentered.camera.zoom === 12.4,
  'Mi ubicación must recenter the persisted camera while preserving zoom.');
assert(recentered.selectedEntityId === null && recentered.mapMovedSinceSearch === false,
  'Mi ubicación must clear the old pin selection and viewport-search prompt.');

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

assert(
  discovery.includes("dispatch({ type: 'set_effective_location', location: point })") &&
    discovery.includes('initialCenter={') &&
    map.includes('cameraRef.current?.easeTo({') &&
    map.includes('center: [initialCenter.longitude, initialCenter.latitude]') &&
    map.includes('[initialCenter.latitude, initialCenter.longitude, initialZoom]'),
  'Mi ubicación must drive the mounted MapLibre camera, not only the search state.',
);
assert(
  discovery.includes('features={mapFeatures}') &&
    discovery.includes('onSelectEntity={selectBusinessFromMap}') &&
    discovery.includes("dispatch({ type: 'set_sheet_snap', snap: 'half' })") &&
    discovery.includes('selectedBusiness = useMemo') &&
    map.includes('onSelectEntity?.(entityId)'),
  'A business pin must select its canonical result and open the in-map preview.',
);
assert(
  discovery.includes('mapStyle={mobileRuntime.mapStyleUrl}') &&
    map.includes('mapStyle={mapStyle}') &&
    map.includes("'text-font': ['Noto Sans']") &&
    map.includes('getClusterExpansionZoom'),
  'MapLibre style, cluster font, and expansion wiring must remain composed.',
);

console.log('PASS: Local Business camera-center viewport search contract');
