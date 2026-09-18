import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), process.argv[2] ?? 'data/food/chile/rm');
const files = fs.readdirSync(root)
  .filter((name) => name.startsWith('independent-outlet-discoveries-') && name.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, 'es'));

const allowedKinds = new Set([
  'official_website', 'official_social', 'merchant_registration',
  'public_registry', 'google_business', 'waze', 'other_public_source',
]);
const validPhone = (value) => /^\+56\d{8,9}$/.test(value);
const validWhatsapp = (value) => /^\+569\d{8}$/.test(value);
const seen = new Set();
let count = 0;

for (const name of files) {
  const payload = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  if (payload.dataset !== 'palta_food_independent_outlet_discoveries_rm') throw new Error(`${name}: unexpected_dataset`);
  if (payload.policy?.collect_images !== false) throw new Error(`${name}: collect_images_must_be_false`);
  if (payload.policy?.live_publish_allowed !== false) throw new Error(`${name}: live_publish_must_be_false_before_authorization`);
  if (!Array.isArray(payload.records)) throw new Error(`${name}: records_required`);

  for (const record of payload.records) {
    count += 1;
    if (!record.outlet_key || seen.has(record.outlet_key)) throw new Error(`${name}: invalid_or_duplicate_outlet_key:${record.outlet_key}`);
    seen.add(record.outlet_key);
    if (!record.brand_name || !record.address || !record.comuna) throw new Error(`${name}: identity_fields_required:${record.outlet_key}`);
    if (!['verified', 'corroborated', 'needs_review', 'possible_virtual_brand'].includes(record.identity_status)) {
      throw new Error(`${name}: invalid_identity_status:${record.outlet_key}`);
    }
    if (!Array.isArray(record.evidence) || !record.evidence.some((item) => allowedKinds.has(item.kind))) {
      throw new Error(`${name}: independent_evidence_required:${record.outlet_key}`);
    }
    if (record.public_contact?.phone && !validPhone(record.public_contact.phone)) throw new Error(`${name}: invalid_phone:${record.outlet_key}`);
    if (record.public_contact?.whatsapp && !validWhatsapp(record.public_contact.whatsapp)) throw new Error(`${name}: invalid_whatsapp:${record.outlet_key}`);
  }
}

console.log(`PASS: ${count} official/independent-source-first food outlet discoveries / no images / no live publish before authorization`);
