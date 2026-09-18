import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const manifestPath = path.join(root, 'manifest', 'mobile-runtime-composition.json');
const remoteName = process.env.PALTA_REMOTE_NAME ?? 'origin';
const strict = process.argv.includes('--strict');

function git(args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function refSha(branch) {
  try {
    return git(['rev-parse', `${remoteName}/${branch}`]);
  } catch {
    return null;
  }
}

function blobSha(ref, repoPath) {
  try {
    return git(['rev-parse', `${ref}:${repoPath}`]);
  } catch {
    return null;
  }
}

function normalizeRepoPath(value) {
  return String(value ?? '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
}

function ownsPath(ownedPaths, candidate) {
  const file = normalizeRepoPath(candidate);
  return ownedPaths.some((raw) => {
    const owned = normalizeRepoPath(raw);
    return file === owned || file.startsWith(`${owned}/`);
  });
}

function changedFiles(fromSha, toSha) {
  if (!fromSha || !toSha || fromSha === toSha) return [];
  try {
    const output = git(['diff', '--name-only', fromSha, toSha, '--']);
    return output ? output.split('\n').map((entry) => entry.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const branchMetadataPaths = (manifest.branch_metadata_paths ?? []).map(normalizeRepoPath);
let driftCount = 0;

for (const surface of manifest.surfaces ?? []) {
  if (typeof surface.source_branch !== 'string') continue;
  const current = refSha(surface.source_branch);
  if (!current) {
    console.log(`SOURCE UNKNOWN: ${surface.id} (${remoteName}/${surface.source_branch} not fetched)`);
    continue;
  }

  const ownershipBaseline =
    surface.integration_mode === 'live_overlay'
      ? surface.ownership_baseline_sha
      : surface.integrated_source_sha;
  const branchOwnedPaths = surface.branch_owned_paths ?? surface.owned_paths ?? [];
  const changed = changedFiles(ownershipBaseline, current);
  const unowned = changed.filter(
    (file) => !ownsPath(branchOwnedPaths, file) && !ownsPath(branchMetadataPaths, file),
  );

  if (unowned.length > 0) {
    driftCount += 1;
    console.log(
      `OWNERSHIP REVIEW REQUIRED: ${surface.id} changed ${unowned.length} path(s) outside its declared branch ownership (${surface.source_branch})`,
    );
    for (const file of unowned.slice(0, 8)) console.log(`  - ${file}`);
    if (unowned.length > 8) console.log(`  - ... ${unowned.length - 8} more`);
  }

  for (const rawPath of surface.reviewed_contract_paths ?? []) {
    const contractPath = normalizeRepoPath(rawPath);
    const sourceBlob = blobSha(`${remoteName}/${surface.source_branch}`, contractPath);
    const composedBlob = blobSha('HEAD', contractPath);
    if (!sourceBlob || !composedBlob || sourceBlob !== composedBlob) {
      driftCount += 1;
      console.log(
        `CONTRACT REVIEW REQUIRED: ${surface.id} ${contractPath} differs from ${surface.source_branch}`,
      );
    } else {
      console.log(`CONTRACT REVIEWED: ${surface.id} ${contractPath}`);
    }
  }

  if (surface.integration_mode === 'live_overlay') {
    console.log(`LIVE: ${surface.id} <= ${surface.source_branch}@${current.slice(0, 12)}`);
    continue;
  }

  const integrated = surface.integrated_source_sha;
  if (current === integrated) {
    console.log(`REVIEWED: ${surface.id} @${current.slice(0, 12)}`);
    continue;
  }

  driftCount += 1;
  console.log(
    `REVIEW REQUIRED: ${surface.id} source advanced ${String(integrated).slice(0, 12)} -> ${current.slice(0, 12)} (${surface.source_branch})`,
  );
}

for (const core of manifest.core_integrations ?? []) {
  if (typeof core.source_branch !== 'string') continue;
  const current = refSha(core.source_branch);
  if (!current) {
    console.log(`CORE SOURCE UNKNOWN: ${core.id} (${remoteName}/${core.source_branch} not fetched)`);
    continue;
  }

  const observed = core.observed_source_sha;
  if (current === observed) {
    console.log(`CORE TRACKED: ${core.id} @${current.slice(0, 12)} (${core.status ?? 'unknown'})`);
    continue;
  }

  driftCount += 1;
  console.log(
    `CORE REVIEW REQUIRED: ${core.id} source advanced ${String(observed).slice(0, 12)} -> ${current.slice(0, 12)} (${core.source_branch})`,
  );
}

if (strict && driftCount > 0) process.exit(2);
