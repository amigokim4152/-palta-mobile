import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const appRoot = path.join(root, 'apps/mobile');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  fs.existsSync(path.join(appRoot, 'package.json')),
  'Runnable Expo shell must already exist at apps/mobile.',
);
assert(
  fs.existsSync(path.join(root, 'mobile-overlay/src')),
  'Canonical mobile overlay source must exist before materialization.',
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
  !discoverySource.includes("useState<'list' | 'map'>") &&
    !discoverySource.includes('<ViewModeSwitch') &&
    discoverySource.includes('<NeighborhoodMap') &&
    discoverySource.includes('<MapResultSheet') &&
    discoverySource.includes("position: 'absolute', top: 0, right: 0, bottom: 0, left: 0") &&
    discoverySource.includes("position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%'"),
  'Generated Negocios runtime must preserve the canonical edge-to-edge map-first experience with connected bottom-sheet results.',
);

console.log('PASS: runnable Expo shell materializes current Local Business map-first UI with live simulator sync');
