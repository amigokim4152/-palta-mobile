import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'manifest/mobile-runtime-composition.json');

function fail(message) {
  throw new Error(message);
}

function normalizeRepoPath(value) {
  if (typeof value !== 'string' || !value.trim()) fail('Composition paths must be non-empty strings.');
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
  if (normalized.startsWith('/') || normalized.includes('../')) fail(`Unsafe repository path: ${value}`);
  return normalized;
}

function containsPath(parent, child) {
  return child === parent || child.startsWith(`${parent}/`);
}

if (!fs.existsSync(manifestPath)) fail('Missing manifest/mobile-runtime-composition.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (manifest.version !== 1) fail(`Unsupported runtime composition version: ${manifest.version}`);
if (manifest.composition_branch !== 'integration/runtime-composition-v1') {
  fail('Runtime composition branch must remain integration/runtime-composition-v1.');
}
if (!Array.isArray(manifest.surfaces) || manifest.surfaces.length === 0) {
  fail('Runtime composition must register at least one surface.');
}

const sharedPaths = (manifest.shared_paths ?? []).map(normalizeRepoPath);
const ownership = [];
const ids = new Set();

for (const surface of manifest.surfaces) {
  if (!surface || typeof surface !== 'object') fail('Invalid surface entry.');
  if (typeof surface.id !== 'string' || !surface.id.trim()) fail('Every surface needs an id.');
  if (ids.has(surface.id)) fail(`Duplicate surface id: ${surface.id}`);
  ids.add(surface.id);

  if (typeof surface.source_branch !== 'string' || !surface.source_branch.startsWith('integration/')) {
    fail(`Surface ${surface.id} must point at an integration/* source branch.`);
  }
  if (!Array.isArray(surface.owned_paths) || surface.owned_paths.length === 0) {
    fail(`Surface ${surface.id} must declare owned_paths.`);
  }

  for (const rawPath of surface.owned_paths) {
    const ownedPath = normalizeRepoPath(rawPath);
    for (const sharedPath of sharedPaths) {
      if (containsPath(sharedPath, ownedPath) || containsPath(ownedPath, sharedPath)) {
        fail(`Surface ${surface.id} cannot own shared composition path ${ownedPath} (conflicts with ${sharedPath}).`);
      }
    }

    for (const existing of ownership) {
      if (existing.surfaceId === surface.id) continue;
      if (containsPath(existing.path, ownedPath) || containsPath(ownedPath, existing.path)) {
        fail(`Surface ownership collision: ${surface.id}:${ownedPath} overlaps ${existing.surfaceId}:${existing.path}.`);
      }
    }
    ownership.push({ surfaceId: surface.id, path: ownedPath });
  }
}

const expectedSurfaceIds = ['home', 'negocios', 'community'];
for (const id of expectedSurfaceIds) {
  if (!ids.has(id)) fail(`Missing required composed surface: ${id}`);
}

const routeAssertions = [
  ['home', 'mobile-overlay/src/app/(tabs)/home.tsx'],
  ['negocios', 'mobile-overlay/src/app/(tabs)/businesses.tsx'],
  ['community', 'mobile-overlay/src/app/(tabs)/community.tsx'],
];
for (const [surfaceId, routePath] of routeAssertions) {
  const surface = manifest.surfaces.find((item) => item.id === surfaceId);
  const ownsRoute = surface.owned_paths.some((entry) => {
    const owned = normalizeRepoPath(entry);
    return containsPath(owned, routePath);
  });
  if (!ownsRoute) fail(`${surfaceId} must own its primary tab route ${routePath}.`);
}

console.log(`PASS: mobile runtime composition ownership (${manifest.surfaces.length} surfaces, ${ownership.length} owned paths)`);
