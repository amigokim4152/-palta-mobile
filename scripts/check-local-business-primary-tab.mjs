import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const tabLayoutPath = path.join(root, 'mobile-overlay/src/app/(tabs)/_layout.tsx');
const tabRoutePath = path.join(root, 'mobile-overlay/src/app/(tabs)/businesses.tsx');
const discoveryPath = path.join(root, 'mobile-overlay/src/features/business/LocalBusinessDiscoveryScreen.tsx');
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
const discovery = parseTsx(discoveryPath);

const homeIndex = layout.indexOf('name="home"');
const businessIndex = layout.indexOf('name="businesses"');
assert(homeIndex >= 0, 'Primary tab layout must include Inicio/home.');
assert(businessIndex > homeIndex, 'Negocios must be placed immediately after Inicio in the primary tab declaration.');

const afterBusiness = layout.slice(businessIndex + 'name="businesses"'.length);
const nextTabMatch = afterBusiness.match(/name="([^"]+)"/);
assert(nextTabMatch?.[1] === 'neighborhood', 'Negocios must remain directly beside Inicio, before Barrio.');

assert(
  route.includes("LocalBusinessDiscoveryScreen") &&
  route.includes('export default LocalBusinessDiscoveryScreen'),
  'Primary Negocios tab must reuse the canonical LocalBusinessDiscoveryScreen instead of creating a parallel implementation.',
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

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const tabKeys = manifest.bottom_tabs?.map((item) => item.key) ?? [];
assert(tabKeys[0] === 'home' && tabKeys[1] === 'businesses', 'Route manifest must place businesses directly after home.');
assert(
  manifest.compatibility_aliases?.['/local-businesses'] === '/(tabs)/businesses',
  'Legacy Local Business route must resolve to the primary Negocios tab.',
);

console.log('PASS: Local Business primary tab source check');
