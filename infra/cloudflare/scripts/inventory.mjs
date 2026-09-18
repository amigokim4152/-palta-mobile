#!/usr/bin/env node

/**
 * Read-only Cloudflare account inventory for Palta infrastructure reuse.
 *
 * Required environment variables:
 *   CLOUDFLARE_API_TOKEN
 *   CLOUDFLARE_ACCOUNT_ID
 *
 * Safety properties:
 * - GET requests only.
 * - Never prints the API token, account ID, Hyperdrive origin/credentials or DB host.
 * - Does not create, modify, deploy or delete any Cloudflare resource.
 * - Intended for local/manual execution only. Do not run this in public CI logs.
 */

const API_BASE = 'https://api.cloudflare.com/client/v4';
const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();

if (!token || !accountId) {
  console.error('Cloudflare inventory requires CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.');
  process.exitCode = 2;
} else {
  await main();
}

function headers() {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
}

function cloudflareError(label, payload, status) {
  const messages = Array.isArray(payload?.errors)
    ? payload.errors.map((item) => item?.message).filter(Boolean)
    : [];
  const detail = messages.length ? messages.join('; ') : `HTTP ${status}`;
  return new Error(`${label}: ${detail}`);
}

async function getJson(path, label) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: headers(),
  });
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${label}: Cloudflare returned a non-JSON response (HTTP ${response.status}).`);
  }
  if (!response.ok || payload?.success === false) {
    throw cloudflareError(label, payload, response.status);
  }
  return payload;
}

async function listR2Buckets() {
  const names = [];
  let cursor;
  do {
    const query = new URLSearchParams({ per_page: '100' });
    if (cursor) query.set('cursor', cursor);
    const payload = await getJson(
      `/accounts/${encodeURIComponent(accountId)}/r2/buckets?${query}`,
      'R2 buckets',
    );
    const buckets = Array.isArray(payload?.result?.buckets)
      ? payload.result.buckets
      : Array.isArray(payload?.result)
        ? payload.result
        : [];
    for (const bucket of buckets) {
      if (typeof bucket?.name === 'string') names.push(bucket.name);
    }
    cursor = payload?.result_info?.cursor || payload?.result?.result_info?.cursor || undefined;
  } while (cursor);
  return names.sort();
}

async function listWorkers() {
  const payload = await getJson(
    `/accounts/${encodeURIComponent(accountId)}/workers/scripts`,
    'Workers scripts',
  );
  return (Array.isArray(payload?.result) ? payload.result : [])
    .map((worker) => worker?.id)
    .filter((name) => typeof name === 'string')
    .sort();
}

async function listQueues() {
  const names = [];
  let page = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({ page: String(page), per_page: '100' });
    const payload = await getJson(
      `/accounts/${encodeURIComponent(accountId)}/queues?${query}`,
      'Queues',
    );
    const queues = Array.isArray(payload?.result) ? payload.result : [];
    for (const queue of queues) {
      if (typeof queue?.queue_name === 'string') names.push(queue.queue_name);
      else if (typeof queue?.name === 'string') names.push(queue.name);
    }
    totalPages = Number(payload?.result_info?.total_pages ?? 1) || 1;
    page += 1;
  } while (page <= totalPages);
  return [...new Set(names)].sort();
}

async function listHyperdrives() {
  const names = [];
  let page = 1;
  let totalPages = 1;
  do {
    const query = new URLSearchParams({ page: String(page), per_page: '50' });
    const payload = await getJson(
      `/accounts/${encodeURIComponent(accountId)}/hyperdrive/configs?${query}`,
      'Hyperdrive configs',
    );
    const configs = Array.isArray(payload?.result) ? payload.result : [];
    for (const config of configs) {
      if (typeof config?.name === 'string') names.push(config.name);
    }
    totalPages = Number(payload?.result_info?.total_pages ?? 1) || 1;
    page += 1;
  } while (page <= totalPages);
  return [...new Set(names)].sort();
}

function paltaCandidates(items) {
  const relevant = /(palta|narevu|map|pmtiles|commerce|payment|fiscal|sii|api)/i;
  return items.filter((name) => relevant.test(name));
}

function printSection(label, result) {
  console.log(`\n${label}`);
  if (!result.ok) {
    console.log(`  UNAVAILABLE: ${result.error}`);
    return;
  }
  if (result.items.length === 0) {
    console.log('  (none)');
    return;
  }
  for (const item of result.items) console.log(`  - ${item}`);
}

async function inspect(label, fn) {
  try {
    return { ok: true, items: await fn() };
  } catch (error) {
    return {
      ok: false,
      items: [],
      error: error instanceof Error ? error.message : `${label}: unknown error`,
    };
  }
}

async function main() {
  console.log('Palta Cloudflare read-only inventory');
  console.log('Mode: GET-only; account ID/token/origin details are not printed.');

  const [workers, r2, queues, hyperdrives] = await Promise.all([
    inspect('Workers', listWorkers),
    inspect('R2', listR2Buckets),
    inspect('Queues', listQueues),
    inspect('Hyperdrive', listHyperdrives),
  ]);

  printSection('Workers', workers);
  printSection('R2 buckets', r2);
  printSection('Queues', queues);
  printSection('Hyperdrive configs', hyperdrives);

  const allCandidates = [
    ...(workers.ok ? paltaCandidates(workers.items).map((name) => `Worker: ${name}`) : []),
    ...(r2.ok ? paltaCandidates(r2.items).map((name) => `R2: ${name}`) : []),
    ...(queues.ok ? paltaCandidates(queues.items).map((name) => `Queue: ${name}`) : []),
    ...(hyperdrives.ok ? paltaCandidates(hyperdrives.items).map((name) => `Hyperdrive: ${name}`) : []),
  ].sort();

  console.log('\nPotential Palta/legacy reuse candidates');
  if (allCandidates.length === 0) console.log('  (none detected by name)');
  else for (const candidate of allCandidates) console.log(`  - ${candidate}`);

  const unavailable = [workers, r2, queues, hyperdrives].filter((result) => !result.ok).length;
  if (unavailable > 0) {
    console.log(`\nINCOMPLETE: ${unavailable} resource group(s) could not be listed. Check read permissions.`);
    process.exitCode = 1;
  } else {
    console.log('\nPASS: Cloudflare read-only inventory completed. No resources were changed.');
  }
}
