import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), process.argv[2] ?? 'data/food/chile/rm');
const files = fs.readdirSync(root)
  .filter((name) => name.startsWith('food-observations-') && name.endsWith('.json'))
  .sort();

const validIdentityStatuses = new Set([
  'verified',
  'corroborated',
  'platform_only',
  'needs_review',
  'possible_virtual_brand',
]);
const validCorroborationStatuses = new Set([
  'verified',
  'corroborated',
  'needs_review',
  'possible_virtual_brand',
]);

const validPhone = (value) => /^\+56\d{8,9}$/.test(value);
const validWhatsapp = (value) => /^\+569\d{8}$/.test(value);

let recordsChecked = 0;
let menuItemsChecked = 0;
let relatedListingsChecked = 0;
let corroborationsChecked = 0;
const seenOutletKeys = new Set();
const seenListingIds = new Set();

const observeListing = (name, listing, outletKey, label) => {
  if (!listing) return;
  if (listing.listing_id) {
    if (seenListingIds.has(listing.listing_id)) {
      throw new Error(`${name}: duplicate_listing_id:${listing.listing_id}`);
    }
    seenListingIds.add(listing.listing_id);
  }
  if (listing.platform && !['uber_eats', 'rappi', 'other'].includes(listing.platform)) {
    throw new Error(`${name}: invalid_platform:${outletKey}:${label}`);
  }
};

for (const name of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  if (payload.dataset !== 'palta_food_observations_rm') {
    throw new Error(`${name}: unexpected_dataset`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.observed_at ?? '')) {
    throw new Error(`${name}: observed_at_required`);
  }
  if (!Array.isArray(payload.records)) throw new Error(`${name}: records_required`);

  for (const record of payload.records) {
    recordsChecked += 1;
    const outlet = record.outlet ?? {};
    const listing = record.listing ?? {};
    const menu = record.menu_snapshot ?? {};

    if (!outlet.outlet_key || typeof outlet.outlet_key !== 'string') {
      throw new Error(`${name}: outlet_key_required`);
    }
    if (seenOutletKeys.has(outlet.outlet_key)) {
      throw new Error(`${name}: duplicate_outlet_key:${outlet.outlet_key}`);
    }
    seenOutletKeys.add(outlet.outlet_key);
    if (!outlet.brand_name || typeof outlet.brand_name !== 'string') {
      throw new Error(`${name}: brand_name_required:${outlet.outlet_key}`);
    }
    if (!validIdentityStatuses.has(outlet.identity_status)) {
      throw new Error(`${name}: invalid_identity_status:${outlet.outlet_key}`);
    }
    if (outlet.public_contact?.phone && !validPhone(outlet.public_contact.phone)) {
      throw new Error(`${name}: invalid_phone:${outlet.outlet_key}`);
    }
    if (outlet.public_contact?.whatsapp && !validWhatsapp(outlet.public_contact.whatsapp)) {
      throw new Error(`${name}: invalid_whatsapp:${outlet.outlet_key}`);
    }

    observeListing(name, listing, outlet.outlet_key, 'current');
    for (const related of record.related_platform_listings ?? []) {
      relatedListingsChecked += 1;
      observeListing(name, related, outlet.outlet_key, 'related');
    }

    if (!Array.isArray(listing.platform_categories)) {
      throw new Error(`${name}: platform_categories_required:${outlet.outlet_key}`);
    }
    if (!Array.isArray(menu.sections)) {
      throw new Error(`${name}: menu_sections_required:${outlet.outlet_key}`);
    }
    if (!Array.isArray(menu.sample_items)) {
      throw new Error(`${name}: menu_sample_items_required:${outlet.outlet_key}`);
    }

    for (const item of menu.sample_items) {
      menuItemsChecked += 1;
      if (!item.name || typeof item.name !== 'string') {
        throw new Error(`${name}: menu_item_name_required:${outlet.outlet_key}`);
      }
      if (item.price_clp !== undefined && (!Number.isInteger(item.price_clp) || item.price_clp < 0)) {
        throw new Error(`${name}: invalid_price:${outlet.outlet_key}:${item.name}`);
      }
    }
  }
}

const corroborationFiles = fs.readdirSync(root)
  .filter((name) => name.startsWith('outlet-corroborations-') && name.endsWith('.json'))
  .sort();
const seenCorroboratedOutlets = new Set();

for (const name of corroborationFiles) {
  const payload = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  if (payload.dataset !== 'palta_food_outlet_corroborations_rm') {
    throw new Error(`${name}: unexpected_corroboration_dataset`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.observed_at ?? '')) {
    throw new Error(`${name}: observed_at_required`);
  }
  if (!Array.isArray(payload.records)) throw new Error(`${name}: records_required`);

  for (const record of payload.records) {
    corroborationsChecked += 1;
    if (!seenOutletKeys.has(record.outlet_key)) {
      throw new Error(`${name}: corroboration_unknown_outlet:${record.outlet_key}`);
    }
    if (seenCorroboratedOutlets.has(record.outlet_key)) {
      throw new Error(`${name}: duplicate_corroboration_outlet:${record.outlet_key}`);
    }
    seenCorroboratedOutlets.add(record.outlet_key);
    if (!validCorroborationStatuses.has(record.identity_status)) {
      throw new Error(`${name}: invalid_corroboration_status:${record.outlet_key}`);
    }
    if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
      throw new Error(`${name}: corroboration_evidence_required:${record.outlet_key}`);
    }
    if (!record.evidence.some((item) => item.kind !== 'uber_eats' && item.kind !== 'rappi')) {
      throw new Error(`${name}: corroboration_independent_source_required:${record.outlet_key}`);
    }
    if (
      (record.identity_status === 'needs_review' || record.identity_status === 'possible_virtual_brand') &&
      !String(record.identity_note ?? '').trim()
    ) {
      throw new Error(`${name}: unresolved_identity_note_required:${record.outlet_key}`);
    }
    const phone = record.public_contact?.phone;
    if (phone && !validPhone(phone)) {
      throw new Error(`${name}: invalid_corroboration_phone:${record.outlet_key}`);
    }
    const whatsapp = record.public_contact?.whatsapp;
    if (whatsapp && !validWhatsapp(whatsapp)) {
      throw new Error(`${name}: invalid_corroboration_whatsapp:${record.outlet_key}`);
    }
  }
}

console.log(
  `PASS: food data catalog ${recordsChecked} outlets / ${menuItemsChecked} sampled menu items / ${relatedListingsChecked} related listings / ${corroborationsChecked} corroborations across ${files.length} observation files`,
);
