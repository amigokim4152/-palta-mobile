import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const tabLayoutPath = path.join(root, 'mobile-overlay/src/app/(tabs)/_layout.tsx');
const tabRoutePath = path.join(root, 'mobile-overlay/src/app/(tabs)/businesses.tsx');
const legacyRoutePath = path.join(root, 'mobile-overlay/src/app/local-businesses/index.tsx');
const discoveryPath = path.join(root, 'mobile-overlay/src/features/business/BusinessDiscoveryExperience.tsx');
const manifestPath = path.join(root, 'manifest/app-route-manifest.json');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseTsx(file) {
  assert(fs.existsSync(file), `Missing source: ${path.relative(root, file)}`);
  const source = fs.readFileSync(file, 'utf8');
  const transpiled = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
    },
  });
  const errors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert(
    errors.length === 0,
    `${path.relative(root, file)} has TypeScript/TSX syntax errors: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join(' | ')}`,
  );
  return source;
}

const layout = parseTsx(tabLayoutPath);
const route = parseTsx(tabRoutePath);
const legacyRoute = parseTsx(legacyRoutePath);
const discovery = parseTsx(discoveryPath);

const homeIndex = layout.indexOf('name="home"');
const businessIndex = layout.indexOf('name="businesses"');
assert(homeIndex >= 0, 'Primary tab layout must include Inicio/home.');
assert(businessIndex > homeIndex, 'Negocios must be placed immediately after Inicio in the primary tab declaration.');
assert(
  layout.includes('name="neighborhood" options={{ href: null }}'),
  'Legacy neighborhood route may remain addressable, but Barrio must not occupy a primary bottom-tab slot.',
);

const primaryUsesCanonicalDiscovery =
  route.includes('BusinessDiscoveryExperience') &&
  (route.includes('export default BusinessDiscoveryExperience') ||
    route.includes('<BusinessDiscoveryExperience />'));
assert(
  primaryUsesCanonicalDiscovery,
  'primary tab must reuse the canonical BusinessDiscoveryExperience instead of creating a parallel Local Business UI.',
);
assert(
  !route.includes('LocalBusinessDiscoveryScreen'),
  'primary tab must not route through a parallel Local Business discovery implementation.',
);
assert(
  route.includes('BusinessVerticalHandoffBar'),
  'Negocios primary tab must expose independent vertical handoffs without moving their inventory state into Local Business.',
);

assert(
  legacyRoute.includes('BusinessDiscoveryExperience') &&
    legacyRoute.includes('export default BusinessDiscoveryExperience'),
  'legacy route must reuse the canonical BusinessDiscoveryExperience instead of creating a parallel Local Business UI.',
);

assert(
  discovery.includes('Explorar Santiago') &&
    discovery.includes('Buscar cerca de mí'),
  'Local Business must support both device location and non-GPS exploration.',
);
assert(
  discovery.includes("router.push('/local-businesses/following')") &&
    discovery.includes("router.push('/business/register')"),
  'Primary Local Business surface must expose relationship and owner entry points.',
);
assert(
  discovery.includes('NeighborhoodMap') &&
    discovery.includes('MapResultSheet') &&
    discovery.includes('Buscar en esta zona') &&
    discovery.includes("position: 'absolute', top: 0, right: 0, bottom: 0, left: 0"),
  'Canonical Negocios experience must be map-first with search/results layered over a stable full map.',
);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const tabKeys = manifest.bottom_tabs?.map((item) => item.key) ?? [];
assert(tabKeys[0] === 'home' && tabKeys[1] === 'businesses', 'Route manifest must place businesses directly after home.');
assert(!tabKeys.includes('neighborhood'), 'Barrio/neighborhood must not remain in the visible bottom-tab manifest.');
assert(
  manifest.compatibility_aliases?.['/local-businesses'] === '/(tabs)/businesses',
  'Legacy Local Business route must resolve to the primary Negocios tab.',
);

console.log('PASS: Local Business primary map-first tab source check');
