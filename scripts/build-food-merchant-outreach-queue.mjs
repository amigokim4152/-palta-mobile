import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), process.argv[2] ?? 'data/food/chile/rm');

const observationFiles = fs.readdirSync(root)
  .filter((name) => name.startsWith('food-observations-') && name.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, 'es'));

const corroborationFiles = fs.readdirSync(root)
  .filter((name) => name.startsWith('outlet-corroborations-') && name.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, 'es'));

const observations = observationFiles.flatMap((name) => {
  const payload = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  return payload.records ?? [];
});

const corroborations = corroborationFiles.flatMap((name) => {
  const payload = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
  return payload.records ?? [];
});

const corroborationByOutlet = new Map(corroborations.map((record) => [record.outlet_key, record]));

const mergeContact = (source, overlay) => ({
  ...(source ?? {}),
  ...(overlay ?? {}),
});

const queue = observations.map((record) => {
  const outlet = record.outlet ?? {};
  const overlay = corroborationByOutlet.get(outlet.outlet_key) ?? {};
  const contact = mergeContact(outlet.public_contact, overlay.public_contact);
  const whatsapp = contact.whatsapp ?? null;
  const phone = contact.phone ?? null;
  const website = contact.website ?? null;
  const hasContact = Boolean(whatsapp || phone || website);

  return {
    outletKey: outlet.outlet_key,
    brandName: outlet.brand_name,
    outletName: outlet.outlet_name ?? null,
    comuna: overlay.comuna ?? outlet.comuna ?? null,
    address: overlay.address ?? outlet.address ?? null,
    whatsapp,
    phone,
    website,
    status: hasContact ? 'ready_to_contact' : 'needs_public_contact',
    requestedScope: [
      'business_identity',
      'outlet_address',
      'public_contact',
      'opening_hours',
      'menu_item_names',
      'menu_prices',
      'delivery_pickup_facts',
    ],
    collectImages: false,
    note: 'Photos/assets are intentionally excluded. Outreach asks only for factual business/menu authorization.',
  };
});

queue.sort((a, b) => {
  const readyDelta = Number(b.status === 'ready_to_contact') - Number(a.status === 'ready_to_contact');
  if (readyDelta !== 0) return readyDelta;
  return String(a.comuna ?? '').localeCompare(String(b.comuna ?? ''), 'es') ||
    String(a.brandName ?? '').localeCompare(String(b.brandName ?? ''), 'es');
});

const ready = queue.filter((item) => item.status === 'ready_to_contact');
const missing = queue.filter((item) => item.status !== 'ready_to_contact');

console.log(JSON.stringify({
  dataset: 'palta_food_merchant_outreach_queue_rm',
  generatedAt: new Date().toISOString(),
  policy: {
    collectImages: false,
    factualFieldsOnly: true,
    sendActionOwnedBy: 'shared_messaging_core',
    authorizationRequiredBeforeCanonicalMerchantUse: true,
  },
  counts: {
    totalOutlets: queue.length,
    readyToContact: ready.length,
    needsPublicContact: missing.length,
  },
  readyToContact: ready,
  needsPublicContact: missing,
}, null, 2));
