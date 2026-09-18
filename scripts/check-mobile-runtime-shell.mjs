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
]) {
  assert(fs.existsSync(path.join(root, relative)), `Missing runtime shell file: ${relative}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
assert(packageJson.main === 'expo-router/entry', 'Mobile runtime must use Expo Router entry.');
assert(packageJson.dependencies?.expo, 'Mobile runtime must declare Expo.');
assert(packageJson.dependencies?.['@maplibre/maplibre-react-native'], 'Mobile runtime must include MapLibre React Native.');

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
  discoverySource.includes("useState<'list' | 'map'>('list')") &&
    discoverySource.includes('<ViewModeSwitch value={viewMode}'),
  'Generated Negocios runtime must open in the list-first production experience with map available as a peer view.',
);

console.log('PASS: runnable Expo shell materializes current Local Business UI');
