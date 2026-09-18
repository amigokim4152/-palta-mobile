import { watch } from 'node:fs';
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const sourceRoot = path.join(root, 'mobile-overlay', 'src');
const appRoot = path.join(root, 'apps', 'mobile');
const destinationRoot = path.join(appRoot, 'src');
const temporaryRoot = path.join(appRoot, '.src-sync-tmp');
const repositoryCoreRoot = path.join(root, 'src');

const textExtensions = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const templateSourcePattern = /\.template\.(?:[cm]?[jt]sx?)$/i;

function normalizeModuleSpecifier(value) {
  return value.split(path.sep).join('/');
}

function rewriteSpecifier(specifier, sourceFile, destinationFile) {
  if (!specifier.startsWith('.')) return specifier;

  const resolvedFromOverlay = path.resolve(path.dirname(sourceFile), specifier);
  const relativeToCore = path.relative(repositoryCoreRoot, resolvedFromOverlay);

  if (relativeToCore.startsWith('..') || path.isAbsolute(relativeToCore)) {
    return specifier;
  }

  let next = path.relative(path.dirname(destinationFile), resolvedFromOverlay);
  next = normalizeModuleSpecifier(next);
  if (!next.startsWith('.')) next = `./${next}`;
  return next;
}

function rewriteRepositoryCoreImports(content, sourceFile, destinationFile) {
  let output = content;

  output = output.replace(
    /(\bfrom\s+)(['"])([^'"]+)\2/g,
    (_full, prefix, quote, specifier) => {
      const nextSpecifier = rewriteSpecifier(specifier, sourceFile, destinationFile);
      return `${prefix}${quote}${nextSpecifier}${quote}`;
    },
  );

  output = output.replace(
    /(\bimport\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
    (_full, prefix, quote, specifier, suffix) => {
      const nextSpecifier = rewriteSpecifier(specifier, sourceFile, destinationFile);
      return `${prefix}${quote}${nextSpecifier}${quote}${suffix}`;
    },
  );

  output = output.replace(
    /(\brequire\s*\(\s*)(['"])([^'"]+)\2(\s*\))/g,
    (_full, prefix, quote, specifier, suffix) => {
      const nextSpecifier = rewriteSpecifier(specifier, sourceFile, destinationFile);
      return `${prefix}${quote}${nextSpecifier}${quote}${suffix}`;
    },
  );

  return output;
}

async function transformTree(currentDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await transformTree(target);
      continue;
    }

    if (!entry.isFile()) continue;

    // mobile-overlay may keep documentation/example adapters as *.template.*,
    // but generated apps/mobile/src must contain only executable runtime code.
    if (templateSourcePattern.test(entry.name)) {
      await rm(target, { force: true });
      continue;
    }

    if (!textExtensions.has(path.extname(entry.name))) continue;

    const relative = path.relative(temporaryRoot, target);
    const sourceFile = path.join(sourceRoot, relative);
    const destinationFile = path.join(destinationRoot, relative);
    const before = await readFile(target, 'utf8');
    const after = rewriteRepositoryCoreImports(before, sourceFile, destinationFile);
    if (after !== before) await writeFile(target, after);
  }
}

export async function syncMobileRuntime() {
  await readFile(path.join(appRoot, 'package.json'), 'utf8').catch(() => {
    throw new Error('apps/mobile runtime shell is missing. Refusing to synthesize a second Expo app.');
  });

  await rm(temporaryRoot, { recursive: true, force: true });
  await mkdir(temporaryRoot, { recursive: true });

  try {
    await cp(sourceRoot, temporaryRoot, { recursive: true });
    await transformTree(temporaryRoot);
    await rm(destinationRoot, { recursive: true, force: true });
    await rename(temporaryRoot, destinationRoot);
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }

  console.log('PASS: materialized mobile-overlay/src into apps/mobile/src');
}

async function watchMobileRuntime() {
  await syncMobileRuntime();
  console.log('WATCH: mobile-overlay/src -> apps/mobile/src (Expo Fast Refresh ready)');

  let debounceTimer;
  let syncing = false;
  let queued = false;
  let lastReason = 'change';

  const flush = async () => {
    if (syncing) {
      queued = true;
      return;
    }

    syncing = true;
    try {
      do {
        queued = false;
        const reason = lastReason;
        await syncMobileRuntime();
        console.log(`WATCH: synced after ${reason}`);
      } while (queued);
    } catch (error) {
      console.error('WATCH: mobile runtime sync failed');
      console.error(error);
    } finally {
      syncing = false;
    }
  };

  const watcher = watch(sourceRoot, { recursive: true }, (_eventType, filename) => {
    lastReason = filename ? String(filename) : 'overlay change';
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void flush();
    }, 90);
  });

  const close = () => {
    clearTimeout(debounceTimer);
    watcher.close();
  };

  process.once('SIGINT', () => {
    close();
    process.exit(0);
  });
  process.once('SIGTERM', () => {
    close();
    process.exit(0);
  });

  await new Promise(() => {});
}

if (process.argv.includes('--watch')) {
  await watchMobileRuntime();
} else {
  await syncMobileRuntime();
}
