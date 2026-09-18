import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'manifest/mobile-runtime-composition.json');
const agentsPath = path.join(root, 'AGENTS.md');
const contractPath = path.join(root, 'docs/MOBILE_RUNTIME_COMPOSITION.md');
const validModes = new Set(['live_overlay', 'reviewed_snapshot']);
const validCoreStatuses = new Set(['pending_contract_integration', 'integrated', 'review_required']);
const shaPattern = /^[0-9a-f]{40}$/;

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

for (const requiredPath of [agentsPath, contractPath, manifestPath]) {
  if (!fs.existsSync(requiredPath)) {
    fail(`Missing runtime composition discovery contract: ${path.relative(root, requiredPath)}`);
  }
}

const agents = fs.readFileSync(agentsPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');
for (const required of [
  'integration/runtime-composition-v1',
  'docs/MOBILE_RUNTIME_COMPOSITION.md',
  'manifest/mobile-runtime-composition.json',
]) {
  if (!agents.includes(required)) {
    fail(`AGENTS.md must point parallel work to ${required}.`);
  }
}
for (const required of [
  'AGENTS.md` on `main',
  'GitHub Issue #9',
  'manifest/mobile-runtime-composition.json',
  'REVIEW REQUIRED',
]) {
  if (!contract.includes(required)) {
    fail(`Runtime composition contract must preserve repository-wide discovery marker: ${required}.`);
  }
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (manifest.version !== 1) fail(`Unsupported runtime composition version: ${manifest.version}`);
if (manifest.composition_branch !== 'integration/runtime-composition-v1') {
  fail('Runtime composition branch must remain integration/runtime-composition-v1.');
}
if (manifest.generated_runtime_root !== 'apps/mobile/src') {
  fail('Composed runtime must materialize only into apps/mobile/src.');
}
if (!Array.isArray(manifest.surfaces) || manifest.surfaces.length === 0) {
  fail('Runtime composition must register at least one surface.');
}
if (!Array.isArray(manifest.core_integrations) || manifest.core_integrations.length === 0) {
  fail('Runtime composition must track shared Core integration branches.');
}
if (!Array.isArray(manifest.branch_metadata_paths) || manifest.branch_metadata_paths.length === 0) {
  fail('Runtime composition must declare branch_metadata_paths for cross-branch handoff files.');
}

const branchMetadataPaths = manifest.branch_metadata_paths.map(normalizeRepoPath);
if (!branchMetadataPaths.includes('AGENTS.md')) {
  fail('AGENTS.md must remain an allowed branch metadata path.');
}
const sharedPaths = (manifest.shared_paths ?? []).map(normalizeRepoPath);
const ownership = [];
const ids = new Set();
let liveSurfaceCount = 0;
let snapshotSurfaceCount = 0;

for (const surface of manifest.surfaces) {
  if (!surface || typeof surface !== 'object') fail('Invalid surface entry.');
  if (typeof surface.id !== 'string' || !surface.id.trim()) fail('Every surface needs an id.');
  if (ids.has(surface.id)) fail(`Duplicate surface id: ${surface.id}`);
  ids.add(surface.id);

  if (typeof surface.source_branch !== 'string' || !surface.source_branch.startsWith('integration/')) {
    fail(`Surface ${surface.id} must point at an integration/* source branch.`);
  }
  if (!validModes.has(surface.integration_mode)) {
    fail(`Surface ${surface.id} has invalid integration_mode ${surface.integration_mode}.`);
  }
  if (surface.integration_mode === 'live_overlay') {
    liveSurfaceCount += 1;
    if (surface.integrated_source_sha !== undefined) {
      fail(`Live surface ${surface.id} must follow its source branch instead of pinning integrated_source_sha.`);
    }
    if (!shaPattern.test(surface.ownership_baseline_sha ?? '')) {
      fail(`Live surface ${surface.id} must record a 40-character ownership_baseline_sha.`);
    }
  } else {
    snapshotSurfaceCount += 1;
    if (!shaPattern.test(surface.integrated_source_sha ?? '')) {
      fail(`Reviewed snapshot ${surface.id} must record a 40-character integrated_source_sha.`);
    }
  }

  if (!Array.isArray(surface.owned_paths) || surface.owned_paths.length === 0) {
    fail(`Surface ${surface.id} must declare owned_paths.`);
  }

  for (const rawPath of surface.owned_paths) {
    const ownedPath = normalizeRepoPath(rawPath);
    if (surface.integration_mode === 'live_overlay' && !ownedPath.startsWith('mobile-overlay/src/')) {
      fail(`Live surface ${surface.id} can overlay only mobile-overlay/src paths: ${ownedPath}.`);
    }

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

const coreIds = new Set();
const coreBranches = new Set();
for (const core of manifest.core_integrations) {
  if (!core || typeof core !== 'object') fail('Invalid Core integration entry.');
  if (typeof core.id !== 'string' || !core.id.trim()) fail('Every Core integration needs an id.');
  if (coreIds.has(core.id)) fail(`Duplicate Core integration id: ${core.id}`);
  coreIds.add(core.id);

  if (typeof core.source_branch !== 'string' || !core.source_branch.startsWith('integration/')) {
    fail(`Core ${core.id} must point at an integration/* source branch.`);
  }
  if (coreBranches.has(core.source_branch)) {
    fail(`Duplicate Core source branch: ${core.source_branch}`);
  }
  coreBranches.add(core.source_branch);

  if (!validCoreStatuses.has(core.status)) {
    fail(`Core ${core.id} has invalid status ${core.status}.`);
  }
  if (!shaPattern.test(core.observed_source_sha ?? '')) {
    fail(`Core ${core.id} must record a 40-character observed_source_sha.`);
  }
}

const expectedCoreIds = ['auth_profile', 'messaging', 'commerce', 'localization', 'map_runtime'];
for (const id of expectedCoreIds) {
  if (!coreIds.has(id)) fail(`Missing required Shared Core watch: ${id}`);
}

const plannedCoreBranches = new Set(manifest.planned_core_integrations ?? []);
for (const branch of coreBranches) {
  if (!plannedCoreBranches.has(branch)) {
    fail(`Tracked Core branch must remain listed in planned_core_integrations until migration completes: ${branch}`);
  }
}

const composerPath = path.join(root, 'scripts/compose-mobile-runtime.mjs');
const watcherPath = path.join(root, 'scripts/watch-runtime-composition.sh');
const driftPath = path.join(root, 'scripts/check-runtime-source-drift.mjs');
for (const requiredPath of [composerPath, watcherPath, driftPath]) {
  if (!fs.existsSync(requiredPath)) {
    fail(`Composed runtime missing required script: ${path.relative(root, requiredPath)}`);
  }
}

const composer = fs.readFileSync(composerPath, 'utf8');
const watcher = fs.readFileSync(watcherPath, 'utf8');
const drift = fs.readFileSync(driftPath, 'utf8');
if (!composer.includes("surface.integration_mode !== 'live_overlay'")) {
  fail('Runtime composer must overlay only explicitly live surfaces.');
}
if (!composer.includes("const prefix = 'mobile-overlay/src/'")) {
  fail('Runtime composer must confine live overlays to mobile-overlay/src.');
}
if (!watcher.includes('manifest.core_integrations') || !watcher.includes('refspecs+=')) {
  fail('Runtime watcher must batch-fetch and monitor Shared Core source branches.');
}
if (!drift.includes('CORE REVIEW REQUIRED') || !drift.includes('observed_source_sha')) {
  fail('Runtime drift check must report Shared Core advances without auto-copying them.');
}
if (!drift.includes('OWNERSHIP REVIEW REQUIRED') || !drift.includes('ownership_baseline_sha')) {
  fail('Runtime drift check must detect feature-branch changes outside declared surface ownership.');
}

console.log(
  `PASS: mobile runtime composition (${manifest.surfaces.length} surfaces; ${liveSurfaceCount} live, ${snapshotSurfaceCount} reviewed; ${manifest.core_integrations.length} Core watches; ${ownership.length} owned paths; ownership + cross-chat discovery protected)`,
);
