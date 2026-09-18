import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), process.argv[2] ?? 'data/food/chile/rm');

const load = (prefix) => fs.readdirSync(root)
  .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, 'es'))
  .flatMap((name) => {
    const payload = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
    return payload.records ?? [];
  });

const observations = load('food-observations-');
const corroborations = load('outlet-corroborations-');
const independentDiscoveries = load('independent-outlet-discoveries-');
const corroborationByOutlet = new Map(corroborations.map((record) => [record.outlet_key, record]));
const independentByOutlet = new Map(independentDiscoveries.map((record) => [record.outlet_key, record]));

const mergeContact = (...sources) => Object.assign({}, ...sources.filter(Boolean));
const outletKeys = new Set([
  ...observations.map((record) => record.outlet?.outlet_key).filter(Boolean),
  ...independentDiscoveries.map((record) => record.outlet_key).filter(Boolean),
]);
const observationByOutlet = new Map(observations.map((record) => [record.outlet?.outlet_key, record]));

const queue = [...outletKeys].map((outletKey) => {
  const research = observationByOutlet.get(outletKey);
  const sourceOutlet = research?.outlet ?? {};
  const corroboration = corroborationByOutlet.get(outletKey) ?? {};
  const independent = independentByOutlet.get(outletKey) ?? {};
  const contact = mergeContact(sourceOutlet.public_contact, corroboration.public_contact, independent.public_contact);
  const identityStatus = independent.identity_status ?? corroboration.identity_status ?? sourceOutlet.identity_status ?? 'platform_only';
  const needsIdentityConfirmation = identityStatus === 'needs_review' || identityStatus === 'possible_virtual_brand';
  const whatsapp = contact.whatsapp ?? null;
  const phone = contact.phone ?? null;
  const website = contact.website ?? null;
  // A website is useful evidence/discovery context, but it is not a direct
  // merchant-contact channel. Only a public business phone/WhatsApp makes the
  // outlet ready for the later outreach phase.
  const hasDirectContact = Boolean(whatsapp || phone);
  const status = !hasDirectContact
    ? 'needs_public_contact'
    : needsIdentityConfirmation
      ? 'ready_for_identity_confirmation'
      : 'ready_to_contact';

  return {
    outletKey,
    brandName: independent.brand_name ?? sourceOutlet.brand_name ?? null,
    outletName: independent.outlet_name ?? sourceOutlet.outlet_name ?? null,
    comuna: independent.comuna ?? corroboration.comuna ?? sourceOutlet.comuna ?? null,
    address: independent.address ?? corroboration.address ?? sourceOutlet.address ?? null,
    sourceAddress: sourceOutlet.address ?? null,
    identityStatus,
    identityNote: independent.identity_note ?? corroboration.identity_note ?? sourceOutlet.identity_note ?? null,
    discoveryLane: independent.outlet_key ? 'independent_source_first' : 'research_then_corroboration',
    whatsapp,
    phone,
    website,
    status,
    requestedScope: [
      'business_identity', 'outlet_address', 'public_contact', 'opening_hours',
      'menu_item_names', 'menu_prices', 'delivery_pickup_facts',
    ],
    collectImages: false,
    note: needsIdentityConfirmation
      ? 'Resolve outlet identity/address conflict before asking for publication authorization.'
      : hasDirectContact
        ? 'Photos/assets are intentionally excluded. Outreach asks only for factual business/menu authorization.'
        : 'Official website may be known, but a public business phone/WhatsApp is still required before direct merchant outreach.',
  };
});

const priority = { ready_for_identity_confirmation: 0, ready_to_contact: 1, needs_public_contact: 2 };
queue.sort((a, b) => (priority[a.status] ?? 9) - (priority[b.status] ?? 9) ||
  String(a.comuna ?? '').localeCompare(String(b.comuna ?? ''), 'es') ||
  String(a.brandName ?? '').localeCompare(String(b.brandName ?? ''), 'es'));

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
    directPublicContactRequiredForOutreachReadiness: true,
  },
  counts: {
    totalOutlets: queue.length,
    independentSourceFirst: queue.filter((item) => item.discoveryLane === 'independent_source_first').length,
    readyForIdentityConfirmation: identityConfirmation.length,
    readyToContact: ready.length,
    needsPublicContact: missing.length,
  },
  readyForIdentityConfirmation: identityConfirmation,
  readyToContact: ready,
  needsPublicContact: missing,
}, null, 2));
