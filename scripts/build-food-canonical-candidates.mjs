import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), process.argv[2] ?? 'data/food/chile/rm');
const independentKinds = new Set([
  'official_website', 'official_social', 'merchant_registration',
  'public_registry', 'google_business', 'waze', 'other_public_source',
]);

const load = (prefix) => fs.readdirSync(root)
  .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
  .sort((a, b) => a.localeCompare(b, 'es'))
  .flatMap((name) => {
    const payload = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
    return payload.records ?? [];
  });

const observations = load('food-observations-');
const corroborations = load('outlet-corroborations-');
const menus = load('menu-corroborations-');

const observationByOutlet = new Map(
  observations
    .filter((record) => record.outlet?.outlet_key)
    .map((record) => [record.outlet.outlet_key, record]),
);
const corroborationByOutlet = new Map(corroborations.map((record) => [record.outlet_key, record]));
const menusByOutlet = new Map();
for (const menu of menus) {
  if (!menu.outlet_key) continue;
  const current = menusByOutlet.get(menu.outlet_key) ?? [];
  current.push(menu);
  menusByOutlet.set(menu.outlet_key, current);
}

function isIndependent(record) {
  return (record.evidence ?? []).some((item) => independentKinds.has(item.kind));
}

function sanitizedMenu(menu) {
  return {
    menuScope: menu.menu_scope,
    source: menu.source,
    sections: menu.sections ?? [],
    items: (menu.items ?? []).map((item) => ({
      name: item.name,
      ...(item.price_clp !== undefined ? { priceClp: item.price_clp } : {}),
      ...(item.price_min_clp !== undefined ? { priceMinClp: item.price_min_clp } : {}),
      ...(item.price_max_clp !== undefined ? { priceMaxClp: item.price_max_clp } : {}),
      ...(item.price_kind !== undefined ? { priceKind: item.price_kind } : {}),
    })),
  };
}

const candidates = [];
const blocked = [];

for (const [outletKey, corroboration] of corroborationByOutlet) {
  const research = observationByOutlet.get(outletKey);
  const identityReady = corroboration.identity_status === 'verified' || corroboration.identity_status === 'corroborated';
  const independent = isIndependent(corroboration);

  if (!identityReady || !independent) {
    blocked.push({ outletKey, reason: !identityReady ? 'identity_not_ready' : 'independent_source_missing' });
    continue;
  }

  const contact = corroboration.public_contact ?? {};
  const hasDirectContact = Boolean(contact.whatsapp || contact.phone);
  const outletMenus = menusByOutlet.get(outletKey) ?? [];

  candidates.push({
    outletKey,
    brandName: research?.outlet?.brand_name ?? null,
    outletName: research?.outlet?.outlet_name ?? null,
    address: corroboration.address ?? research?.outlet?.address ?? null,
    comuna: corroboration.comuna ?? research?.outlet?.comuna ?? null,
    publicContact: {
      phone: contact.phone ?? null,
      whatsapp: contact.whatsapp ?? null,
      website: contact.website ?? null,
    },
    identityStatus: corroboration.identity_status,
    operationalStatus: hasDirectContact ? 'ready_for_merchant_outreach' : 'needs_direct_public_contact',
    merchantAuthorizationStatus: 'pending',
    livePublishAllowed: false,
    collectImages: false,
    independentEvidence: corroboration.evidence ?? [],
    independentlyObservedMenus: outletMenus.map(sanitizedMenu),
    menuStatus: outletMenus.length ? 'independent_menu_evidence_available' : 'needs_independent_menu_evidence',
  });
}

candidates.sort((a, b) => {
  const statusDelta = Number(b.operationalStatus === 'ready_for_merchant_outreach') -
    Number(a.operationalStatus === 'ready_for_merchant_outreach');
  if (statusDelta !== 0) return statusDelta;
  return String(a.comuna ?? '').localeCompare(String(b.comuna ?? ''), 'es') ||
    String(a.brandName ?? '').localeCompare(String(b.brandName ?? ''), 'es');
});

const brandLevelMenus = menus
  .filter((menu) => !menu.outlet_key && menu.brand_name)
  .map((menu) => ({
    brandName: menu.brand_name,
    status: 'requires_outlet_binding_before_publish',
    collectImages: false,
    menu: sanitizedMenu(menu),
  }));

console.log(JSON.stringify({
  dataset: 'palta_food_pre_contact_canonical_candidates_rm',
  generatedAt: new Date().toISOString(),
  policy: {
    factualFieldsOnly: true,
    collectImages: false,
    merchantAuthorizationRequiredForLiveFoodLaunch: true,
    noAutomaticMessaging: true,
  },
  counts: {
    candidates: candidates.length,
    readyForMerchantOutreach: candidates.filter((item) => item.operationalStatus === 'ready_for_merchant_outreach').length,
    withIndependentMenuEvidence: candidates.filter((item) => item.independentlyObservedMenus.length > 0).length,
    blocked: blocked.length,
    unboundBrandMenus: brandLevelMenus.length,
  },
  candidates,
  blocked,
  brandLevelMenus,
}, null, 2));
