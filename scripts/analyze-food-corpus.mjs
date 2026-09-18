import fs from 'node:fs';
import path from 'node:path';

const inputPath = process.argv[2] ?? 'data/food/chile/rm/food-observations-2026-09-18.json';
const resolved = path.resolve(process.cwd(), inputPath);
const payload = JSON.parse(fs.readFileSync(resolved, 'utf8'));
const records = Array.isArray(payload.records) ? payload.records : [];

const increment = (map, key) => {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
};

const categoryCount = new Map();
const sectionCount = new Map();
const itemTokenCount = new Map();
const addressListings = new Map();
const identityCount = new Map();
const contactCoverage = { phone: 0, website: 0, whatsapp: 0 };
let itemCount = 0;

const stopwords = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'a', 'en', 'para', 'por',
  'un', 'una', 'x', 'al', 'sin', 'mas', 'más', 'eleccion', 'elección', 'piezas',
]);

for (const record of records) {
  const outlet = record.outlet ?? {};
  const listing = record.listing ?? {};
  const menu = record.menu_snapshot ?? {};

  increment(identityCount, outlet.identity_status ?? 'unknown');
  if (outlet.public_contact?.phone) contactCoverage.phone += 1;
  if (outlet.public_contact?.website) contactCoverage.website += 1;
  if (outlet.public_contact?.whatsapp) contactCoverage.whatsapp += 1;

  const normalizedAddress = String(outlet.address ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (normalizedAddress) {
    const current = addressListings.get(normalizedAddress) ?? [];
    current.push({
      outletKey: outlet.outlet_key,
      brandName: outlet.brand_name,
      listingId: listing.listing_id,
    });
    addressListings.set(normalizedAddress, current);
  }

  for (const category of listing.platform_categories ?? []) increment(categoryCount, category);
  for (const section of menu.sections ?? []) increment(sectionCount, section);

  for (const item of menu.sample_items ?? []) {
    itemCount += 1;
    const tokens = String(item.name ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3 && !stopwords.has(token));
    for (const token of new Set(tokens)) increment(itemTokenCount, token);
  }
}

const sortCounts = (map, limit = 30) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'es'))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));

const sharedAddresses = [...addressListings.entries()]
  .filter(([, listings]) => listings.length > 1)
  .map(([address, listings]) => ({ address, listings }));

const output = {
  dataset: payload.dataset,
  observedAt: payload.observed_at,
  outletCount: records.length,
  sampledItemCount: itemCount,
  identityStatuses: Object.fromEntries(identityCount),
  publicContactCoverage: contactCoverage,
  topPlatformCategories: sortCounts(categoryCount),
  topMenuSections: sortCounts(sectionCount),
  topItemTokens: sortCounts(itemTokenCount, 50),
  sharedAddresses,
  note: 'Counts describe the observed corpus. They are inputs to taxonomy design, not consumer categories by themselves.',
};

console.log(JSON.stringify(output, null, 2));
