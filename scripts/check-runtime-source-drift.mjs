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

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
let driftCount = 0;

for (const surface of manifest.surfaces ?? []) {
  if (typeof surface.source_branch !== 'string') continue;
  const current = refSha(surface.source_branch);
  if (!current) {
    console.log(`SOURCE UNKNOWN: ${surface.id} (${remoteName}/${surface.source_branch} not fetched)`);
    continue;
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

if (strict && driftCount > 0) process.exit(2);
