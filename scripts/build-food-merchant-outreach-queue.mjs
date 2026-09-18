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
  const identityStatus = overlay.identity_status ?? outlet.identity_status ?? 'platform_only';
  const needsIdentityConfirmation = identityStatus === 'needs_review' || identityStatus === 'possible_virtual_brand';
  const status = !hasContact
    ? 'needs_public_contact'
    : needsIdentityConfirmation
      ? 'ready_for_identity_confirmation'
      : 'ready_to_contact';

  return {
    outletKey: outlet.outlet_key,
    brandName: outlet.brand_name,
    outletName: outlet.outlet_name ?? null,
    comuna: overlay.comuna ?? outlet.comuna ?? null,
    address: overlay.address ?? outlet.address ?? null,
    sourceAddress: outlet.address ?? null,
    identityStatus,
    identityNote: overlay.identity_note ?? outlet.identity_note ?? null,
    whatsapp,
    phone,
    website,
    status,
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
    note: needsIdentityConfirmation
      ? 'Resolve outlet identity/address conflict before asking for publication authorization.'
      : 'Photos/assets are intentionally excluded. Outreach asks only for factual business/menu authorization.',
  };
});

const priority = {
  ready_for_identity_confirmation: 0,
  ready_to_contact: 1,
  needs_public_contact: 2,
};

queue.sort((a, b) => {
  const statusDelta = (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
  if (statusDelta !== 0) return statusDelta;
  return String(a.comuna ?? '').localeCompare(String(b.comuna ?? ''), 'es') ||
    String(a.brandName ?? '').localeCompare(String(b.brandName ?? ''), 'es');
});

const identityConfirmation = queue.filter((item) => item.status === 'ready_for_identity_confirmation');
const ready = queue.filter((item) => item.status === 'ready_to_contact');
const missing = queue.filter((item) => item.status === 'needs_public_contact');

console.log(JSON.stringify({
  dataset: 'palta_food_merchant_outreach_queue_rm',
  generatedAt: new Date().toISOString(),
  policy: {
    collectImages: false,
    factualFieldsOnly: true,
    sendActionOwnedBy: 'shared_messaging_core',
    authorizationRequiredBeforeCanonicalMerchantUse: true,
    identityConflictMustBeResolvedBeforeAuthorization: true,
  },
  counts: {
    totalOutlets: queue.length,
    readyForIdentityConfirmation: identityConfirmation.length,
    readyToContact: ready.length,
    needsPublicContact: missing.length,
  },
  readyForIdentityConfirmation: identityConfirmation,
  readyToContact: ready,
  needsPublicContact: missing,
}, null, 2));
