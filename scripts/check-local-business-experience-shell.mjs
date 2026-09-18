import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const discoveryPath = path.join(root, 'mobile-overlay/src/features/business/BusinessDiscoveryExperience.tsx');
const cachePath = path.join(root, 'mobile-overlay/src/features/business/localBusinessDiscoveryCache.ts');
const asyncResourcePath = path.join(root, 'mobile-overlay/src/hooks/useAsyncResource.ts');
const mapPath = path.join(root, 'mobile-overlay/src/components/map/NeighborhoodMap.tsx');
const sheetPath = path.join(root, 'mobile-overlay/src/components/neighborhood/MapResultSheet.tsx');
const resultCardPath = path.join(root, 'mobile-overlay/src/components/LocalResultCard.tsx');
const detailPath = path.join(root, 'mobile-overlay/src/features/business/BusinessProfileExperience.tsx');
const providerPath = path.join(root, 'mobile-overlay/src/app/_layout.tsx');
const previewPath = path.join(root, 'src/business/localBusinessDiscoveryPreview.ts');

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
const preview = readTsx(previewPath);

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
  !discovery.includes("useState<'list' | 'map'>") &&
  !discovery.includes('<ViewModeSwitch') &&
  discovery.includes('<NeighborhoodMap'),
  'Negocios must open directly on the map; results belong in the connected bottom sheet rather than a separate list-first screen.',
);
assert(
  discovery.includes('initialCenter={neighborhood.camera?.center ?? neighborhood.effectiveLocation}') &&
  discovery.includes('initialZoom={neighborhood.camera?.zoom ?? 14}'),
  'Map must restore the persisted discovery camera when returning from detail/Care.',
);
assert(
  discovery.includes('selectedBusiness') &&
  discovery.includes('Seleccionado') &&
  discovery.includes("dispatch({ type: 'set_sheet_snap', snap: 'half' })"),
  'Map pin selection must open a useful full-width in-context business preview before navigating away.',
);
assert(
  discovery.includes(".filter((item) => item.location !== undefined)") &&
  discovery.includes("'Zona de atención'"),
  'Area-only businesses must remain discoverable without fabricating a precise map pin.',
);
assert(
  discovery.includes('readLocalBusinessDiscoveryCache') &&
  discovery.includes('writeLocalBusinessDiscoveryCache') &&
  discovery.includes('initialData: cachedResults'),
  'Returning from detail must reuse a short-lived discovery cache while refreshing in the background.',
);
assert(
  discovery.includes("position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%'") &&
  discovery.includes("position: 'absolute', top: 0, right: 0, bottom: 0, left: 0") &&
  discovery.includes('resultsContent'),
  'Result sheet must be edge-to-edge over a stable full map instead of sitting inside an inset card container.',
);
assert(
  discovery.includes('SearchBar') && discovery.includes('SafeAreaView'),
  'Negocios must keep usable search controls layered over the map without restoring the old inset discovery frame.',
);
assert(
  discovery.includes('preview: readLocalBusinessDiscoveryPreview(item)') &&
  discovery.includes('localBusinessConsumerCategoryLabel(item.category_key)') &&
  discovery.includes('imageUrl={item.preview.photoUrl}') &&
  discovery.includes('highlight={item.preview.highlight?.label}') &&
  !discovery.includes('function discoveryVisual') &&
  !discovery.includes('CATEGORY_SERVICE_LABELS') &&
  !discovery.includes("'Negocio verificado'"),
  'Discovery cards must consume the bounded Core preview and explicit consumer category copy instead of parsing raw API fields in the screen.',
);
assert(
  preview.includes('readLocalBusinessDiscoveryPreview') &&
  preview.includes("kind: 'coupon' | 'post' | 'unknown'") &&
  preview.includes('CONSUMER_CATEGORY_LABELS') &&
  preview.includes('return CONSUMER_CATEGORY_LABELS[categoryKey]'),
  'Core preview boundary must normalize legacy wire data without exposing unmapped taxonomy keys.',
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
  sheet.includes('PanResponder.create') &&
  sheet.includes('onPanResponderMove') &&
  sheet.includes('nearestSnap'),
  'Result sheet must be directly draggable instead of depending on arrow buttons for normal navigation.',
);
assert(
  sheet.includes('<ScrollView') &&
  sheet.includes('useWindowDimensions') &&
  sheet.includes("width: '100%'") &&
  sheet.includes('paddingHorizontal: 0'),
  'Result sheet must scroll, adapt to the device and remain full-width without outer side gaps.',
);
assert(
  resultCard.includes("width: '100%'") &&
  !resultCard.includes('borderRadius: selected ? paltaTheme.radius.surface : 0'),
  'Business result rows must fill the sheet instead of becoming floating cards with empty side space.',
);
assert(
  detail.includes('useNeighborhoodState') &&
  detail.includes('accessibilityLabel="Volver a negocios"') &&
  detail.includes('router.back()'),
  'Business profile must return to the preserved discovery session, not start a new search context.',
);
assert(
  detail.includes('ProfileHero') && detail.includes('BusinessActionBar'),
  'Polished Business profile must keep visual identity and primary actions above long-form sections.',
);

console.log('PASS: Local Business edge-to-edge map-first experience shell with canonical preview boundary');
