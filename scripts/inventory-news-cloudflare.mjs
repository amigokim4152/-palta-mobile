#!/usr/bin/env node
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const workerIndex = args.indexOf('--worker');
const workerName =
  workerIndex >= 0 && args[workerIndex + 1]
    ? args[workerIndex + 1]
    : process.env.PALTA_EDGE_WORKER_NAME || '';

function runWrangler(label, wranglerArgs) {
  return new Promise((resolve) => {
    console.log(`\n=== ${label} ===`);
    const child = spawn(
      'npx',
      ['--yes', 'wrangler', ...wranglerArgs],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          CI: '1',
        },
      },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += String(chunk); });
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', (error) => {
      console.error(`${label}: unable to start Wrangler: ${error.message}`);
      resolve({ ok: false, code: null });
    });
    child.on('close', (code) => {
      if (stdout.trim()) console.log(stdout.trim());
      if (stderr.trim()) console.error(stderr.trim());
      resolve({ ok: code === 0, code });
    });
  });
}

console.log('Palta News · Cloudflare read-only inventory');
console.log('This command does NOT deploy, create, delete, upload, bind, or change Cloudflare resources.');
console.log('Wrangler runs with CI=1 so missing authentication fails instead of starting an interactive login flow.');

const identity = await runWrangler('ACCOUNT / AUTH', ['whoami']);
if (!identity.ok) {
  console.error('\nINVENTORY STOPPED: Cloudflare authentication is not available in this shell. No changes were made.');
  process.exit(2);
}

const buckets = await runWrangler('R2 BUCKETS', ['r2', 'bucket', 'list']);
if (!buckets.ok) {
  console.error('\nINVENTORY INCOMPLETE: authenticated, but R2 bucket listing failed. No changes were made.');
  process.exit(3);
}

if (workerName) {
  const deployments = await runWrangler(`WORKER DEPLOYMENTS · ${workerName}`, [
    'deployments', 'list', '--name', workerName, '--json',
  ]);
  const versions = await runWrangler(`WORKER VERSIONS · ${workerName}`, [
    'versions', 'list', '--name', workerName, '--json',
  ]);
  if (!deployments.ok || !versions.ok) {
    console.error('\nINVENTORY PARTIAL: R2 inventory succeeded, but the requested Worker name could not be fully inspected. No changes were made.');
    process.exit(4);
  }
} else {
  console.log('\n=== WORKER ===');
  console.log('No Worker name was supplied. R2 inventory is complete; Worker deployment lookup was skipped.');
  console.log('Optional: npm run news:cloudflare-inventory -- --worker <existing-worker-name>');
}

console.log('\nINVENTORY COMPLETE: read-only inspection finished. No Cloudflare resources were changed.');
