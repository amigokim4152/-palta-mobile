import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'data/food/chile/rm');
const files = fs.readdirSync(root)
  .filter((name) => name.startsWith('food-observations-') && name.endsWith('.json'))
  .sort();
if (!files.length) throw new Error('food_catalog_missing_observation_files');

const seenOutletKeys = new Set();
const seenListingIds = new Set();
let recordsChecked = 0;
let menuItemsChecked = 0;

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

    if (!outlet.outlet_key || !outlet.brand_name) throw new Error(`${name}: outlet_identity_required`);
    if (seenOutletKeys.has(outlet.outlet_key)) throw new Error(`${name}: duplicate_outlet_key:${outlet.outlet_key}`);
    seenOutletKeys.add(outlet.outlet_key);

    if (!listing.listing_id || !listing.url || listing.platform !== 'uber_eats') {
      throw new Error(`${name}: uber_listing_required:${outlet.outlet_key}`);
    }
    if (seenListingIds.has(listing.listing_id)) throw new Error(`${name}: duplicate_listing_id:${listing.listing_id}`);
    seenListingIds.add(listing.listing_id);

    if (!Array.isArray(listing.platform_categories)) {
      throw new Error(`${name}: platform_categories_required:${outlet.outlet_key}`);
    }
    if (!Array.isArray(menu.sections) || !Array.isArray(menu.sample_items)) {
      throw new Error(`${name}: menu_snapshot_required:${outlet.outlet_key}`);
    }

    const phone = outlet.public_contact?.phone;
    if (phone && !/^\+56\d{8,9}$/.test(phone)) {
      throw new Error(`${name}: invalid_public_phone:${outlet.outlet_key}`);
    }
    const whatsapp = outlet.public_contact?.whatsapp;
    if (whatsapp && !/^\+56\d{9}$/.test(whatsapp)) {
      throw new Error(`${name}: invalid_public_whatsapp:${outlet.outlet_key}`);
    }

    if (!Array.isArray(record.evidence) || !record.evidence.some((item) => item.kind === 'uber_eats')) {
      throw new Error(`${name}: uber_evidence_required:${outlet.outlet_key}`);
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

console.log(`PASS: food data catalog ${recordsChecked} outlets / ${menuItemsChecked} sampled menu items across ${files.length} observation files`);
