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

function loadCorroborations(targetPath) {
  const baseDir = fs.statSync(targetPath).isDirectory() ? targetPath : path.dirname(targetPath);
  if (!fs.existsSync(baseDir)) return [];

  return fs.readdirSync(baseDir)
    .filter((name) => name.startsWith('outlet-corroborations-') && name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, 'es'))
    .flatMap((name) => {
      const file = path.join(baseDir, name);
      const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
      return (payload.records ?? []).map((record) => ({ ...record, __sourceFile: file }));
    });
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const payloads = loadPayloads(resolved);
const records = payloads.flatMap(({ payload }) => Array.isArray(payload.records) ? payload.records : []);
const corroborations = loadCorroborations(resolved);
const corroborationByOutlet = new Map(corroborations.map((record) => [record.outlet_key, record]));

const increment = (map, key) => {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
};

const categoryCount = new Map();
const sectionCount = new Map();
const itemTokenCount = new Map();
const dishSignalCount = new Map();
const servingSignalCount = new Map();
const addressListings = new Map();
const sourceIdentityCount = new Map();
const effectiveIdentityCount = new Map();
const brandCount = new Map();
const comunaCount = new Map();
const listingIds = new Set();
const outletKeys = new Set();
const duplicateListingIds = [];
const duplicateOutletKeys = [];
const effectiveContactCoverage = { phone: 0, website: 0, whatsapp: 0 };
const sourceContactCoverage = { phone: 0, website: 0, whatsapp: 0 };
let itemCount = 0;
let pricedItemCount = 0;
let currentListingCount = 0;
let relatedListingCount = 0;
let closedPlatformListings = 0;
let overlayAppliedCount = 0;
let unmatchedDishItemCount = 0;

const stopwords = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'con', 'y', 'a', 'en', 'para', 'por',
  'un', 'una', 'x', 'al', 'sin', 'mas', 'más', 'eleccion', 'elección', 'piezas',
]);

// These are descriptive corpus signals, not consumer-facing Palta categories.
// They are intentionally allowed to overlap. The source menu name is always preserved.
const DISH_SIGNALS = [
  ['completo_hotdog', /\b(completo|hot ?dog|perro caliente)\b/],
  ['churrasco', /\bchurrasco\b/],
  ['lomito', /\blomito\b/],
  ['burger', /\b(hamburguesa|burger|smash)\b/],
  ['pizza', /\bpizza\b/],
  ['sushi_roll', /\b(sushi|roll|maki|hand ?roll|uramaki|nigiri|sashimi)\b/],
  ['chicken', /\b(pollo|alita|alitas|broaster|fried chicken)\b/],
  ['ceviche', /\bceviche\b/],
  ['lomo_saltado', /\blomo salta(do|da)\b/],
  ['chaufa', /\bchaufa\b/],
  ['empanada', /\bempanada\b/],
  ['tequeno', /\btequeno(s)?\b/],
  ['shawarma_kebab', /\b(shawarma|shawerma|kebab)\b/],
  ['arepa', /\barepa\b/],
  ['taco_burrito', /\b(taco|tacos|burrito|burritos|quesadilla|nacho|nachos)\b/],
  ['indian_curry', /\b(curry|masala|tikka|biryani|basmati)\b/],
  ['ramen', /\bramen\b/],
  ['bibimbap', /\bbibimbap\b/],
  ['tteokbokki', /\b(tteokbokki|topokki|tokbokki)\b/],
  ['noodle_pasta', /\b(tallarin|tallarines|pasta|fettuccine|spaghetti|noodle|noodles)\b/],
  ['rice_dish', /\b(arroz|risotto)\b/],
  ['salad_bowl', /\b(ensalada|bowl|poke)\b/],
  ['seafood', /\b(marisco|mariscos|ostion|ostiones|macha|machas|jaiba|camaron|camarones|pescado)\b/],
  ['bakery_pastry', /\b(pan|croissant|pastel|pasteleria|torta|queque|berlin|berlines)\b/],
  ['ice_cream', /\b(helado|gelato)\b/],
  ['coffee_tea', /\b(cafe|coffee|espresso|latte|capuccino|cappuccino|te|matcha)\b/],
];

const SERVING_SIGNALS = [
  ['two_for_one', /\b(2 ?x ?1|2x1)\b/],
  ['combo', /\b(combo|duo|dueto)\b/],
  ['family', /\b(familiar|familia|family)\b/],
  ['share', /\b(para compartir|compartir|tabla|banquete)\b/],
  ['promotion', /\b(promo|promocion|oferta|descuento|ahorro)\b/],
  ['meal_deal', /\b(menu|menú|colacion|colación)\b/],
  ['by_weight', /\b(kg|kilo|gramos|gr\.)\b/],
];

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

function mergeOutlet(sourceOutlet, overlay) {
  if (!overlay) return sourceOutlet;
  overlayAppliedCount += 1;
  return {
    ...sourceOutlet,
    address: overlay.address ?? sourceOutlet.address,
    comuna: overlay.comuna ?? sourceOutlet.comuna,
    region: overlay.region ?? sourceOutlet.region,
    postal_code: overlay.postal_code ?? sourceOutlet.postal_code,
    location: overlay.location ?? sourceOutlet.location,
    identity_status: overlay.identity_status ?? sourceOutlet.identity_status,
    public_contact: {
      ...(sourceOutlet.public_contact ?? {}),
      ...(overlay.public_contact ?? {}),
    },
  };
}

for (const record of records) {
  const sourceOutlet = record.outlet ?? {};
  const overlay = corroborationByOutlet.get(sourceOutlet.outlet_key);
  const outlet = mergeOutlet(sourceOutlet, overlay);
  const listing = record.listing ?? {};
  const menu = record.menu_snapshot ?? {};

  increment(sourceIdentityCount, sourceOutlet.identity_status ?? 'unknown');
  increment(effectiveIdentityCount, outlet.identity_status ?? 'unknown');
  increment(brandCount, outlet.brand_name ?? 'unknown');
  increment(comunaCount, outlet.comuna ?? 'unknown');

  if (sourceOutlet.public_contact?.phone) sourceContactCoverage.phone += 1;
  if (sourceOutlet.public_contact?.website) sourceContactCoverage.website += 1;
  if (sourceOutlet.public_contact?.whatsapp) sourceContactCoverage.whatsapp += 1;
  if (outlet.public_contact?.phone) effectiveContactCoverage.phone += 1;
  if (outlet.public_contact?.website) effectiveContactCoverage.website += 1;
  if (outlet.public_contact?.whatsapp) effectiveContactCoverage.whatsapp += 1;

  observeListing(listing, false);
  for (const related of record.related_platform_listings ?? []) observeListing(related, true);

  if (outlet.outlet_key) {
    if (outletKeys.has(outlet.outlet_key)) duplicateOutletKeys.push(outlet.outlet_key);
    outletKeys.add(outlet.outlet_key);
  }

  const normalizedAddress = normalize(outlet.address).replace(/[^a-z0-9]+/g, ' ').trim();
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

    const normalizedName = normalize(item.name);
    const tokens = normalizedName
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3 && !stopwords.has(token));
    for (const token of new Set(tokens)) increment(itemTokenCount, token);

    let matchedDish = false;
    for (const [signal, pattern] of DISH_SIGNALS) {
      if (pattern.test(normalizedName)) {
        increment(dishSignalCount, signal);
        matchedDish = true;
      }
    }
    if (!matchedDish) unmatchedDishItemCount += 1;

    const servingText = normalize(`${item.name ?? ''} ${item.source_section_name ?? ''}`);
    for (const [signal, pattern] of SERVING_SIGNALS) {
      if (pattern.test(servingText)) increment(servingSignalCount, signal);
    }
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
const effectiveCanonicalReadyCount = [...effectiveIdentityCount.entries()]
  .filter(([status]) => status === 'verified' || status === 'corroborated')
  .reduce((sum, [, count]) => sum + count, 0);

const output = {
  dataset: 'palta_food_observations_rm',
  inputFiles: payloads.map(({ file }) => path.relative(process.cwd(), file)),
  corroborationRecordCount: corroborations.length,
  corroborationAppliedCount: overlayAppliedCount,
  observedDates,
  outletCount: records.length,
  platformListingCount: currentListingCount + relatedListingCount,
  currentListingCount,
  relatedListingCount,
  sampledItemCount: itemCount,
  pricedItemCount,
  priceCoverage: itemCount ? Number((pricedItemCount / itemCount).toFixed(4)) : 0,
  closedPlatformListings,
  sourceIdentityStatuses: Object.fromEntries(sourceIdentityCount),
  effectiveIdentityStatuses: Object.fromEntries(effectiveIdentityCount),
  effectiveCanonicalReadyCount,
  effectiveCanonicalReadyCoverage: records.length
    ? Number((effectiveCanonicalReadyCount / records.length).toFixed(4))
    : 0,
  sourcePublicContactCoverage: sourceContactCoverage,
  effectivePublicContactCoverage: effectiveContactCoverage,
  topComunas: sortCounts(comunaCount),
  topPlatformCategories: sortCounts(categoryCount),
  topMenuSections: sortCounts(sectionCount),
  topItemTokens: sortCounts(itemTokenCount, 50),
  dishSignals: sortCounts(dishSignalCount, 50),
  servingSignals: sortCounts(servingSignalCount, 30),
  unmatchedDishItemCount,
  unmatchedDishCoverage: itemCount ? Number((unmatchedDishItemCount / itemCount).toFixed(4)) : 0,
  sharedAddresses,
  duplicateListingIds: [...new Set(duplicateListingIds)],
  duplicateOutletKeys: [...new Set(duplicateOutletKeys)],
  repeatedBrands: sortCounts(new Map([...brandCount].filter(([, count]) => count > 1))),
  note: 'Counts describe the observed corpus. Dish/serving signals are descriptive analysis aids, not consumer categories by themselves.',
};

console.log(JSON.stringify(output, null, 2));
