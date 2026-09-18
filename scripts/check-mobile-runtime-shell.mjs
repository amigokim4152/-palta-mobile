import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRoot = path.join(root, 'apps/mobile');
const compositionManifest = path.join(root, 'manifest/mobile-runtime-composition.json');
const composedRuntime = fs.existsSync(compositionManifest);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const requiredFiles = [
  'apps/mobile/package.json',
  'apps/mobile/app.config.ts',
  'apps/mobile/metro.config.js',
  'apps/mobile/tsconfig.json',
  'scripts/sync-mobile-runtime.mjs',
  'scripts/run-ios-mobile.sh',
  'scripts/watch-local-business-simulator.sh',
];
if (composedRuntime) {
  requiredFiles.push(
    'scripts/compose-mobile-runtime.mjs',
    'scripts/watch-runtime-composition.sh',
    'scripts/check-mobile-runtime-composition.mjs',
  );
}
for (const relative of requiredFiles) {
  assert(fs.existsSync(path.join(root, relative)), `Missing runtime shell file: ${relative}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
assert(packageJson.main === 'expo-router/entry', 'Mobile runtime must use Expo Router entry.');
assert(packageJson.dependencies?.expo, 'Mobile runtime must declare Expo.');
assert(
  packageJson.dependencies?.['@maplibre/maplibre-react-native'],
  'Mobile runtime must include MapLibre React Native.',
);

const syncSource = fs.readFileSync(path.join(root, 'scripts/sync-mobile-runtime.mjs'), 'utf8');
const iosRunnerSource = fs.readFileSync(path.join(root, 'scripts/run-ios-mobile.sh'), 'utf8');
const localBusinessWatcher = fs.readFileSync(
  path.join(root, 'scripts/watch-local-business-simulator.sh'),
  'utf8',
);
assert(
  syncSource.includes("process.argv.includes('--watch')") &&
    syncSource.includes('watch(sourceRoot, { recursive: true }'),
  'Mobile overlay sync must support live watch mode for simulator Fast Refresh.',
);
assert(
  iosRunnerSource.includes('sync-mobile-runtime.mjs') &&
    (iosRunnerSource.includes('watch-runtime-composition.sh') || iosRunnerSource.includes('--watch')),
  'iOS runner must keep the active runtime synchronized while Expo is running.',
);
assert(
  localBusinessWatcher.includes('git merge --ff-only') &&
    localBusinessWatcher.includes('integration/local-business-v1'),
  'Local Business live watcher must only use safe fast-forward updates on the intended branch.',
);

if (composedRuntime) {
  execFileSync(process.execPath, [path.join(root, 'scripts/check-mobile-runtime-composition.mjs')], {
    cwd: root,
    stdio: 'pipe',
  });
  execFileSync(process.execPath, [path.join(root, 'scripts/compose-mobile-runtime.mjs')], {
    cwd: root,
    stdio: 'pipe',
  });
} else {
  execFileSync(process.execPath, [path.join(root, 'scripts/sync-mobile-runtime.mjs')], {
    cwd: root,
    stdio: 'pipe',
  });
}

const generatedBusinessTab = path.join(appRoot, 'src/app/(tabs)/businesses.tsx');
const generatedBusinessProfile = path.join(appRoot, 'src/app/business/[businessId].tsx');
const generatedDiscovery = path.join(appRoot, 'src/features/business/BusinessDiscoveryExperience.tsx');

for (const file of [generatedBusinessTab, generatedBusinessProfile, generatedDiscovery]) {
  assert(fs.existsSync(file), `Runtime materialization missing: ${path.relative(root, file)}`);
}

const tabSource = fs.readFileSync(generatedBusinessTab, 'utf8');
const discoverySource = fs.readFileSync(generatedDiscovery, 'utf8');
assert(
  tabSource.includes('BusinessDiscoveryExperience'),
  'Generated Negocios tab must use the canonical BusinessDiscoveryExperience.',
);
assert(
  discoverySource.includes('NeighborhoodMap') &&
    discoverySource.includes('MapResultSheet') &&
    discoverySource.includes('Buscar en esta zona') &&
    !discoverySource.includes('<ViewModeSwitch'),
  'Generated Negocios runtime must use the full-map discovery surface with the result sheet as its list.',
);
assert(
  discoverySource.includes("position: 'absolute', left: 0, right: 0, bottom: 0"),
  'Generated Negocios result sheet must span the full map width.',
);

if (composedRuntime) {
  const generatedHome = path.join(appRoot, 'src/features/home/HomeScreen.tsx');
  const generatedCommunity = path.join(appRoot, 'src/features/community/CommunityScreen.tsx');
  assert(fs.existsSync(generatedHome), 'Composed runtime must include Home.');
  assert(fs.existsSync(generatedCommunity), 'Composed runtime must include Community.');
  const homeSource = fs.readFileSync(generatedHome, 'utf8');
  const communitySource = fs.readFileSync(generatedCommunity, 'utf8');
  assert(
    homeSource.includes('AHORA') && homeSource.includes('PRÓXIMO') && homeSource.includes('PARA HOY'),
    'Composed Home must preserve the functional life-inbox hierarchy.',
  );
  assert(
    communitySource.includes('Mis comunidades') && communitySource.includes('Descubrir'),
    'Composed Community must preserve the functional community discovery/feed surface.',
  );
}

console.log(
  composedRuntime
    ? 'PASS: runnable Expo shell materializes composed Home + Negocios + Community runtime'
    : 'PASS: runnable Expo shell materializes current Local Business UI with live simulator sync',
);
