import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const manifestPath = path.join(root, 'manifest', 'mobile-runtime-composition.json');
const appSourceRoot = path.join(root, 'apps', 'mobile', 'src');
const repositoryCoreRoot = path.join(root, 'src');
const remoteName = process.env.PALTA_REMOTE_NAME ?? 'origin';
const textExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json']);

function fail(message) {
  throw new Error(message);
}

function git(args, options = {}) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: options.binary ? null : 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  });
}

function normalizeRepoPath(value) {
  if (typeof value !== 'string' || !value.trim()) fail('Composition paths must be non-empty strings.');
  const normalized = value.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/$/, '');
  if (normalized.startsWith('/') || normalized.includes('../')) fail(`Unsafe repository path: ${value}`);
  return normalized;
}

function runtimeRelativePath(repoPath) {
  const normalized = normalizeRepoPath(repoPath);
  const prefix = 'mobile-overlay/src/';
  if (!normalized.startsWith(prefix)) {
    fail(`Live runtime overlay path must stay under ${prefix}: ${repoPath}`);
  }
  return normalized.slice(prefix.length);
}

function remoteRef(branch) {
  return `${remoteName}/${branch}`;
}

function ensureRef(ref) {
  try {
    git(['rev-parse', '--verify', `${ref}^{commit}`]);
  } catch {
    fail(`Missing fetched runtime source ref ${ref}. Run the runtime watcher or git fetch first.`);
  }
}

function gitObjectType(ref, repoPath) {
  try {
    return git(['cat-file', '-t', `${ref}:${repoPath}`]).trim();
  } catch {
    fail(`Runtime source ${ref} does not contain owned path ${repoPath}.`);
  }
}

function listFiles(ref, repoPath, objectType) {
  if (objectType === 'blob') return [repoPath];
  if (objectType !== 'tree') fail(`Unsupported git object ${objectType} for ${repoPath}.`);
  const output = git(['ls-tree', '-r', '--name-only', ref, '--', repoPath]).trim();
  return output ? output.split('\n').filter(Boolean) : [];
}

function normalizeModuleSpecifier(value) {
  return value.split(path.sep).join('/');
}

function rewriteSpecifier(specifier, sourceFile, destinationFile) {
  if (!specifier.startsWith('.')) return specifier;

  const resolvedFromOverlay = path.resolve(path.dirname(sourceFile), specifier);
  const relativeToCore = path.relative(repositoryCoreRoot, resolvedFromOverlay);
  if (relativeToCore.startsWith('..') || path.isAbsolute(relativeToCore)) return specifier;

  let next = path.relative(path.dirname(destinationFile), resolvedFromOverlay);
  next = normalizeModuleSpecifier(next);
  if (!next.startsWith('.')) next = `./${next}`;
  return next;
}

function rewriteRepositoryCoreImports(content, sourceFile, destinationFile) {
  let output = content;
  output = output.replace(
    /(\bfrom\s+)(['"])([^'"]+)\2/g,
    (_full, prefix, quote, specifier) =>
      `${prefix}${quote}${rewriteSpecifier(specifier, sourceFile, destinationFile)}${quote}`,
  );
  output = output.replace(
    /(\bimport\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
    (_full, prefix, quote, specifier, suffix) =>
      `${prefix}${quote}${rewriteSpecifier(specifier, sourceFile, destinationFile)}${quote}${suffix}`,
  );
  output = output.replace(
    /(\brequire\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
    (_full, prefix, quote, specifier, suffix) =>
      `${prefix}${quote}${rewriteSpecifier(specifier, sourceFile, destinationFile)}${quote}${suffix}`,
  );
  return output;
}

async function writeGitFile(ref, repoPath) {
  const relative = runtimeRelativePath(repoPath);
  const destination = path.join(appSourceRoot, relative);
  const sourceFile = path.join(root, repoPath);
  const bytes = git(['show', `${ref}:${repoPath}`], { binary: true });
  await mkdir(path.dirname(destination), { recursive: true });

  if (textExtensions.has(path.extname(repoPath).toLowerCase())) {
    const before = bytes.toString('utf8');
    const after = rewriteRepositoryCoreImports(before, sourceFile, destination);
    await writeFile(destination, after, 'utf8');
  } else {
    await writeFile(destination, bytes);
  }
}

async function overlayOwnedPath(ref, repoPath) {
  const objectType = gitObjectType(ref, repoPath);
  const relative = runtimeRelativePath(repoPath);
  const destination = path.join(appSourceRoot, relative);
  await rm(destination, { recursive: true, force: true });
  const files = listFiles(ref, repoPath, objectType);
  for (const file of files) await writeGitFile(ref, file);
  return files.length;
}

async function readManifest() {
  const raw = await readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  if (manifest.version !== 1) fail(`Unsupported runtime composition manifest version: ${manifest.version}`);
  if (manifest.composition_branch !== 'integration/runtime-composition-v1') {
    fail(`Unexpected composition branch: ${manifest.composition_branch}`);
  }
  return manifest;
}

async function materializeCompositionBase() {
  execFileSync(process.execPath, [path.join(root, 'scripts', 'sync-mobile-runtime.mjs')], {
    cwd: root,
    stdio: 'inherit',
  });
}

async function main() {
  const manifest = await readManifest();
  await materializeCompositionBase();

  let overlaidFiles = 0;
  for (const surface of manifest.surfaces ?? []) {
    if (surface.integration_mode !== 'live_overlay') continue;
    if (typeof surface.source_branch !== 'string') fail(`Surface ${surface.id} is missing source_branch.`);
    const ref = remoteRef(surface.source_branch);
    ensureRef(ref);

    for (const rawPath of surface.owned_paths ?? []) {
      overlaidFiles += await overlayOwnedPath(ref, normalizeRepoPath(rawPath));
    }
    const sha = git(['rev-parse', ref]).trim().slice(0, 12);
    console.log(`COMPOSE: ${surface.id} <= ${ref}@${sha}`);
  }

  console.log(`PASS: composed mobile runtime (${overlaidFiles} live-overlay files)`);
}

await main();
