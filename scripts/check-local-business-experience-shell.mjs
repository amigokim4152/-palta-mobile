import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const discoveryPath = path.join(root, 'mobile-overlay/src/features/business/LocalBusinessDiscoveryScreen.tsx');
const cachePath = path.join(root, 'mobile-overlay/src/features/business/localBusinessDiscoveryCache.ts');
const asyncResourcePath = path.join(root, 'mobile-overlay/src/hooks/useAsyncResource.ts');
const mapPath = path.join(root, 'mobile-overlay/src/components/map/NeighborhoodMap.tsx');
const sheetPath = path.join(root, 'mobile-overlay/src/components/neighborhood/MapResultSheet.tsx');
const resultCardPath = path.join(root, 'mobile-overlay/src/components/LocalResultCard.tsx');
const detailPath = path.join(root, 'mobile-overlay/src/app/business/[businessId].tsx');
const providerPath = path.join(root, 'mobile-overlay/src/app/_layout.tsx');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readTsx(file) {
  assert(fs.existsSync(file), `Missing source: ${path.relative(root, file)}`);
  const source = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
    },
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert(
    errors.length === 0,
    `${path.relative(root, file)} has syntax errors: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join(' | ')}`,
  );
  return source;
}

const discovery = readTsx(discoveryPath);
const cache = readTsx(cachePath);
const asyncResource = readTsx(asyncResourcePath);
const map = readTsx(mapPath);
const sheet = readTsx(sheetPath);
const resultCard = readTsx(resultCardPath);
const detail = readTsx(detailPath);
const provider = readTsx(providerPath);

assert(
  provider.includes('<NeighborhoodStateProvider>') && provider.includes('<Stack'),
  'Discovery state provider must wrap the route stack so detail/Care navigation does not reset discovery context.',
);

assert(
  discovery.includes("neighborhood.activeFilters.includes(FILTER_VERIFIED)") &&
  discovery.includes("neighborhood.activeFilters.includes(FILTER_OPEN_NOW)"),
  'Open-now and verified filters must live in shared discovery state rather than screen-local state.',
);
assert(
  discovery.includes('initialCenter={neighborhood.camera?.center ?? neighborhood.effectiveLocation}') &&
  discovery.includes('initialZoom={neighborhood.camera?.zoom ?? 14}'),
  'Map must restore the persisted discovery camera when returning from detail/Care.',
);
assert(
  discovery.includes('SELECCIONADO EN EL MAPA') &&
  discovery.includes("dispatch({ type: 'set_sheet_snap', snap: 'peek' })"),
  'Map pin selection must open an in-context business preview before navigating away.',
);
assert(
  discovery.includes(".filter((item) => item.location !== undefined)") &&
  discovery.includes("'Zona de atención'"),
  'Area-only businesses must remain list-discoverable without fabricating a precise map pin.',
);
assert(
  discovery.includes('readLocalBusinessDiscoveryCache') &&
  discovery.includes('writeLocalBusinessDiscoveryCache') &&
  discovery.includes('initialData: cachedResults'),
  'Returning from detail must reuse a short-lived discovery cache while refreshing in the background.',
);

assert(
  cache.includes('MAX_ENTRIES = 12') && cache.includes('MAX_AGE_MS = 2 * 60 * 1000'),
  'Discovery cache must remain small and short-lived.',
);
assert(
  cache.includes('const entries = new Map') &&
  !cache.includes('localStorage') &&
  !cache.includes('AsyncStorage') &&
  !cache.includes('sessionStorage'),
  'Discovery cache must remain memory-only so precise search context is not silently persisted.',
);
assert(
  asyncResource.includes('isEmptyRef.current = options?.isEmpty') &&
  asyncResource.includes('}, [enabled, loader]);'),
  'Async resource refresh must not restart merely because an inline empty predicate changed identity.',
);

assert(
  map.includes('getClusterExpansionZoom') && map.includes('easeTo'),
  'Map clusters must expand smoothly instead of behaving like dead markers.',
);
assert(
  map.includes('SELECTION_PADDING') && map.includes('padding: SELECTION_PADDING'),
  'Selecting a business pin must leave visual room for the result sheet rather than centering it underneath the sheet.',
);
assert(
  map.includes('palta-local-selected-point') && map.includes("['get', 'selected']"),
  'Selected business must have a distinct map layer so list/map selection feels connected.',
);

assert(
  map.includes("from '../../theme/paltaTheme'") &&
  sheet.includes("from '../../theme/paltaTheme'") &&
  resultCard.includes("from '../theme/paltaTheme'"),
  'Map, sheet and result cards must consume the shared Palta theme rather than drift into a Local Business-only visual system.',
);

assert(
  sheet.includes('<Animated.View') && sheet.includes('Animated.timing'),
  'Result sheet snap changes must animate instead of jumping between fixed heights.',
);
assert(
  sheet.includes('<ScrollView') && sheet.includes('useWindowDimensions'),
  'Result sheet must scroll long result sets and adapt its snap heights to the device.',
);

assert(
  detail.includes('useNeighborhoodState') &&
  detail.includes('Volver a negocios') &&
  detail.includes('router.back()'),
  'Business detail must return to the preserved discovery session, not start a new search context.',
);

console.log('PASS: Local Business connected discovery experience shell');
