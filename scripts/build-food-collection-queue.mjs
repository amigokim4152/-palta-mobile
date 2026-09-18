import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), process.argv[2] ?? 'data/food/chile/rm');
const coveragePath = path.join(root, 'corpus-coverage.json');
const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));

const observationFiles = fs.readdirSync(root)
  .filter((name) => name.startsWith('food-observations-') && name.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, 'es'));

const records = observationFiles.flatMap((name) => {
  const payload = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  return payload.records ?? [];
});

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function priorityWeight(priority) {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

const comunaCounts = new Map();
const brandCounts = new Map();
const addressCounts = new Map();
let sampledMenuItems = 0;
let closedListings = 0;
let needsReview = 0;
let possibleVirtual = 0;

for (const record of records) {
  const outlet = record.outlet ?? {};
  const listing = record.listing ?? {};
  const menu = record.menu_snapshot ?? {};
  const comuna = outlet.comuna ?? 'unknown';
  comunaCounts.set(comuna, (comunaCounts.get(comuna) ?? 0) + 1);
  brandCounts.set(outlet.brand_name, (brandCounts.get(outlet.brand_name) ?? 0) + 1);
  sampledMenuItems += (menu.sample_items ?? []).length;

  if (listing.observed_availability === 'closed_on_platform') closedListings += 1;
  if (outlet.identity_status === 'needs_review') needsReview += 1;
  if (outlet.identity_status === 'possible_virtual_brand') possibleVirtual += 1;

  const address = normalize(outlet.address).replace(/[^a-z0-9]+/g, ' ').trim();
  if (address) addressCounts.set(address, (addressCounts.get(address) ?? 0) + 1);
}

const sharedAddressGroups = [...addressCounts.values()].filter((count) => count > 1).length;
const repeatedBrandCount = [...brandCounts.values()].filter((count) => count > 1).length;

const laneStats = (coverage.dish_supply_lanes ?? []).map((lane) => {
  const examples = (lane.examples ?? []).map(normalize).filter(Boolean);
  let outletHits = 0;
  let itemHits = 0;

  for (const record of records) {
    const listingText = normalize([
      record.outlet?.brand_name,
      ...(record.listing?.platform_categories ?? []),
      ...(record.menu_snapshot?.sections ?? []),
    ].filter(Boolean).join(' '));
    const items = record.menu_snapshot?.sample_items ?? [];
    const outletMatched = examples.some((example) => listingText.includes(example)) ||
      items.some((item) => examples.some((example) => normalize(item.name).includes(example)));
    if (outletMatched) outletHits += 1;

    for (const item of items) {
      const itemText = normalize(item.name);
      if (examples.some((example) => itemText.includes(example))) itemHits += 1;
    }
  }

  return {
    id: lane.id,
    priority: lane.priority,
    outletHits,
    itemHits,
    examples: lane.examples,
  };
});

const priorityComunas = (coverage.priority_comunas ?? []).map((comuna) => ({
  comuna,
  outletCount: comunaCounts.get(comuna) ?? 0,
}));

const sparseComunas = [...priorityComunas]
  .sort((a, b) => a.outletCount - b.outletCount || a.comuna.localeCompare(b.comuna, 'es'));

const sparseLanes = [...laneStats]
  .sort((a, b) => {
    const priorityDelta = priorityWeight(b.priority) - priorityWeight(a.priority);
    if (priorityDelta !== 0) return priorityDelta;
    return a.outletHits - b.outletHits || a.id.localeCompare(b.id, 'es');
  });

const queue = [];
const queueComunas = sparseComunas.slice(0, 12);
const queueLanes = sparseLanes.slice(0, 12);
const maxQueue = Math.max(queueComunas.length, queueLanes.length);
for (let index = 0; index < maxQueue; index += 1) {
  const comuna = queueComunas[index % queueComunas.length];
  const lane = queueLanes[index % queueLanes.length];
  queue.push({
    priority: index < 6 ? 'high' : 'medium',
    comuna: comuna.comuna,
    lane: lane.id,
    currentComunaOutlets: comuna.outletCount,
    currentLaneOutletHits: lane.outletHits,
    examples: lane.examples,
    instruction: 'Discover real currently/publicly listed outlets, then capture outlet identity + public address/contact + platform listing + menu sections + item names/prices in one pass.',
  });
}

const gate = coverage.gate_before_consumer_taxonomy_v1 ?? {};
const priorityComunasWithData = priorityComunas.filter((entry) => entry.outletCount > 0).length;
const riskExamples = [
  sharedAddressGroups > 0,
  needsReview > 0,
  closedListings > 0,
  repeatedBrandCount > 0,
  possibleVirtual > 0,
].filter(Boolean).length;

const output = {
  generatedAt: new Date().toISOString(),
  dataset: 'palta_food_collection_queue_rm',
  corpus: {
    outletCount: records.length,
    sampledMenuItems,
    priorityComunasWithData,
    totalPriorityComunas: priorityComunas.length,
  },
  gateProgress: {
    outlets: { current: records.length, target: gate.minimum_outlets ?? null },
    sampledMenuItems: { current: sampledMenuItems, target: gate.minimum_sampled_menu_items ?? null },
    priorityComunasWithData: { current: priorityComunasWithData, target: gate.minimum_priority_comunas_with_data ?? null },
    identityRiskExamples: { current: riskExamples, target: gate.required_identity_risk_examples ?? null },
  },
  identityRiskSignals: {
    sharedAddressGroups,
    needsReview,
    closedListings,
    repeatedBrandCount,
    possibleVirtual,
  },
  sparsePriorityComunas: sparseComunas,
  sparseDishLanes: sparseLanes,
  nextCollectionQueue: queue,
  note: 'Queue balances geography and observed dish-supply gaps. It is a research queue, not consumer navigation or a demand forecast.',
};

console.log(JSON.stringify(output, null, 2));
