import fs from 'node:fs';
import path from 'node:path';

const inputPath = process.argv[2] ?? 'data/food/chile/rm';
const resolved = path.resolve(process.cwd(), inputPath);

function loadPayloads(targetPath) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return [{ file: targetPath, payload: JSON.parse(fs.readFileSync(targetPath, 'utf8')) }];
  }

  return fs.readdirSync(targetPath)
    .filter((name) => name.startsWith('food-observations-') && name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map((name) => {
      const file = path.join(targetPath, name);
      return { file, payload: JSON.parse(fs.readFileSync(file, 'utf8')) };
    });
}

const payloads = loadPayloads(resolved);
const records = payloads.flatMap(({ payload }) => Array.isArray(payload.records) ? payload.records : []);

const increment = (map, key) => {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
};

const categoryCount = new Map();
const sectionCount = new Map();
const itemTokenCount = new Map();
const addressListings = new Map();
const identityCount = new Map();
const brandCount = new Map();
const comunaCount = new Map();
const listingIds = new Set();
const outletKeys = new Set();
const duplicateListingIds = [];
const duplicateOutletKeys = [];
const contactCoverage = { phone: 0, website: 0, whatsapp: 0 };
let itemCount = 0;
let pricedItemCount = 0;
let currentListingCount = 0;
let relatedListingCount = 0;
let closedPlatformListings = 0;

const stopwords = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'a', 'en', 'para', 'por',
  'un', 'una', 'x', 'al', 'sin', 'mas', 'más', 'eleccion', 'elección', 'piezas',
]);

function observeListing(listing, related = false) {
  if (!listing) return;
  if (related) relatedListingCount += 1;
  else currentListingCount += 1;
  if (listing.observed_availability === 'closed_on_platform') closedPlatformListings += 1;
  if (listing.listing_id) {
    if (listingIds.has(listing.listing_id)) duplicateListingIds.push(listing.listing_id);
    listingIds.add(listing.listing_id);
  }
}

for (const record of records) {
  const outlet = record.outlet ?? {};
  const listing = record.listing ?? {};
  const menu = record.menu_snapshot ?? {};

  increment(identityCount, outlet.identity_status ?? 'unknown');
  increment(brandCount, outlet.brand_name ?? 'unknown');
  increment(comunaCount, outlet.comuna ?? 'unknown');
  if (outlet.public_contact?.phone) contactCoverage.phone += 1;
  if (outlet.public_contact?.website) contactCoverage.website += 1;
  if (outlet.public_contact?.whatsapp) contactCoverage.whatsapp += 1;

  observeListing(listing, false);
  for (const related of record.related_platform_listings ?? []) observeListing(related, true);

  if (outlet.outlet_key) {
    if (outletKeys.has(outlet.outlet_key)) duplicateOutletKeys.push(outlet.outlet_key);
    outletKeys.add(outlet.outlet_key);
  }

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
      identityStatus: outlet.identity_status,
    });
    addressListings.set(normalizedAddress, current);
  }

  for (const category of listing.platform_categories ?? []) increment(categoryCount, category);
  for (const section of menu.sections ?? []) increment(sectionCount, section);

  for (const item of menu.sample_items ?? []) {
    itemCount += 1;
    if (Number.isFinite(item.price_clp)) pricedItemCount += 1;
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

const observedDates = [...new Set(payloads.map(({ payload }) => payload.observed_at).filter(Boolean))].sort();
const output = {
  dataset: 'palta_food_observations_rm',
  inputFiles: payloads.map(({ file }) => path.relative(process.cwd(), file)),
  observedDates,
  outletCount: records.length,
  platformListingCount: currentListingCount + relatedListingCount,
  currentListingCount,
  relatedListingCount,
  sampledItemCount: itemCount,
  pricedItemCount,
  priceCoverage: itemCount ? Number((pricedItemCount / itemCount).toFixed(4)) : 0,
  closedPlatformListings,
  identityStatuses: Object.fromEntries(identityCount),
  publicContactCoverage: contactCoverage,
  topComunas: sortCounts(comunaCount),
  topPlatformCategories: sortCounts(categoryCount),
  topMenuSections: sortCounts(sectionCount),
  topItemTokens: sortCounts(itemTokenCount, 50),
  sharedAddresses,
  duplicateListingIds: [...new Set(duplicateListingIds)],
  duplicateOutletKeys: [...new Set(duplicateOutletKeys)],
  repeatedBrands: sortCounts(new Map([...brandCount].filter(([, count]) => count > 1))),
  note: 'Counts describe the observed corpus. They are inputs to taxonomy design, not consumer categories by themselves.',
};

console.log(JSON.stringify(output, null, 2));
