import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRoot = path.join(root, 'apps/mobile');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const relative of [
  'apps/mobile/package.json',
  'apps/mobile/app.config.ts',
  'apps/mobile/metro.config.js',
  'apps/mobile/tsconfig.json',
  'scripts/sync-mobile-runtime.mjs',
  'scripts/run-ios-mobile.sh',
  'scripts/watch-local-business-simulator.sh',
]) {
  assert(fs.existsSync(path.join(root, relative)), `Missing runtime shell file: ${relative}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
assert(packageJson.main === 'expo-router/entry', 'Mobile runtime must use Expo Router entry.');
assert(packageJson.dependencies?.expo, 'Mobile runtime must declare Expo.');
assert(packageJson.dependencies?.['@maplibre/maplibre-react-native'], 'Mobile runtime must include MapLibre React Native.');

const syncSource = fs.readFileSync(path.join(root, 'scripts/sync-mobile-runtime.mjs'), 'utf8');
const iosRunnerSource = fs.readFileSync(path.join(root, 'scripts/run-ios-mobile.sh'), 'utf8');
const liveWatcherSource = fs.readFileSync(
  path.join(root, 'scripts/watch-local-business-simulator.sh'),
  'utf8',
);
assert(
  syncSource.includes("process.argv.includes('--watch')") &&
    syncSource.includes('watch(sourceRoot, { recursive: true }'),
  'Mobile overlay sync must support live watch mode for simulator Fast Refresh.',
);
assert(
  iosRunnerSource.includes('sync-mobile-runtime.mjs\\\" --watch') ||
    iosRunnerSource.includes('sync-mobile-runtime.mjs" --watch'),
  'iOS runner must keep mobile-overlay synchronized while Expo is running.',
);
assert(
  liveWatcherSource.includes('git merge --ff-only') &&
    liveWatcherSource.includes('integration/local-business-v1'),
  'Local Business live watcher must only use safe fast-forward updates on the intended branch.',
);

execFileSync(process.execPath, [path.join(root, 'scripts/sync-mobile-runtime.mjs')], {
  cwd: root,
  stdio: 'pipe',
});

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
  discoverySource.includes('<NeighborhoodMap') &&
    discoverySource.includes('<MapResultSheet') &&
    discoverySource.includes('Buscar en esta zona') &&
    discoverySource.includes("position: 'absolute', top: 0, right: 0, bottom: 0, left: 0") &&
    !discoverySource.includes("useState<'list' | 'map'>"),
  'Generated Negocios runtime must remain the full-map production experience with an edge-to-edge result sheet.',
);
assert(
  discoverySource.includes('preview: readLocalBusinessDiscoveryPreview(item)') &&
    discoverySource.includes('imageUrl={item.preview.photoUrl}') &&
    discoverySource.includes('highlight={item.preview.highlight?.label}') &&
    !discoverySource.includes('function discoveryVisual'),
  'Generated Negocios runtime must consume the bounded canonical discovery preview instead of parsing transport fields in the screen.',
);

console.log('PASS: runnable Expo shell materializes current map-first Local Business UI with live simulator sync');
