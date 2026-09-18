import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), process.argv[2] ?? 'data/food/chile/rm');
const files = fs.readdirSync(root)
  .filter((name) => name.startsWith('menu-corroborations-') && name.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, 'es'));

const forbiddenKeys = new Set([
  'image', 'image_url', 'photo', 'photo_url', 'photos', 'gallery',
  'review', 'reviews', 'rating', 'ratings', 'description', 'long_description',
]);

const allowedSources = new Set([
  'official_website', 'official_social', 'merchant_registration',
  'public_registry', 'google_business', 'waze', 'other_public_source',
]);

function walk(value, pathLabel, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${pathLabel}[${index}]`, errors));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key.toLowerCase())) {
      errors.push(`${pathLabel}.${key}: forbidden non-factual/media field`);
    }
    walk(child, `${pathLabel}.${key}`, errors);
  }
}

const errors = [];
let recordCount = 0;
let itemCount = 0;

for (const name of files) {
  const file = path.join(root, name);
  const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
  const records = payload.records ?? [];
  walk(payload, name, errors);

  if (payload.policy?.collect_images !== false) {
    errors.push(`${name}: collect_images must be false`);
  }

  for (const [index, record] of records.entries()) {
    recordCount += 1;
    const label = `${name}:records[${index}]`;
    if (!record.outlet_key && !record.brand_name) errors.push(`${label}: missing outlet_key/brand_name`);
    if (!record.source?.url) errors.push(`${label}: missing source.url`);
    if (!allowedSources.has(record.source?.kind)) errors.push(`${label}: source must be independent, not delivery-platform research`);

    for (const [itemIndex, item] of (record.items ?? []).entries()) {
      itemCount += 1;
      const itemLabel = `${label}.items[${itemIndex}]`;
      if (!String(item.name ?? '').trim()) errors.push(`${itemLabel}: missing name`);
      for (const key of ['price_clp', 'price_min_clp', 'price_max_clp']) {
        if (item[key] !== undefined && (!Number.isFinite(item[key]) || item[key] < 0)) {
          errors.push(`${itemLabel}.${key}: invalid CLP price`);
        }
      }
      if (
        Number.isFinite(item.price_min_clp) && Number.isFinite(item.price_max_clp) &&
        item.price_min_clp > item.price_max_clp
      ) {
        errors.push(`${itemLabel}: price_min_clp exceeds price_max_clp`);
      }
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`PASS: ${recordCount} independent menu records / ${itemCount} factual menu items / no copied image-review-description fields`);
