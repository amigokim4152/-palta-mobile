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
const independentDiscoveries = load('independent-outlet-discoveries-');
const menus = load('menu-corroborations-');

const observationByOutlet = new Map(observations.filter((record) => record.outlet?.outlet_key).map((record) => [record.outlet.outlet_key, record]));
const independentByOutlet = new Map(independentDiscoveries.map((record) => [record.outlet_key, record]));
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
function identityReady(record) {
  return record.identity_status === 'verified' || record.identity_status === 'corroborated';
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
function candidateFrom(record, research, discoveryLane) {
  const contact = record.public_contact ?? {};
  const outletMenus = menusByOutlet.get(record.outlet_key) ?? [];
  return {
    outletKey: record.outlet_key,
    brandName: record.brand_name ?? research?.outlet?.brand_name ?? null,
    outletName: record.outlet_name ?? research?.outlet?.outlet_name ?? null,
    address: record.address ?? research?.outlet?.address ?? null,
    comuna: record.comuna ?? research?.outlet?.comuna ?? null,
    publicContact: {
      phone: contact.phone ?? null,
      whatsapp: contact.whatsapp ?? null,
      website: contact.website ?? null,
    },
    identityStatus: record.identity_status,
    discoveryLane,
    operationalStatus: contact.whatsapp || contact.phone ? 'ready_for_merchant_outreach' : 'needs_direct_public_contact',
    merchantAuthorizationStatus: 'pending',
    livePublishAllowed: false,
    collectImages: false,
    independentEvidence: record.evidence ?? [],
    independentlyObservedMenus: outletMenus.map(sanitizedMenu),
    menuStatus: outletMenus.length ? 'independent_menu_evidence_available' : 'needs_independent_menu_evidence',
  };
}

const candidates = [];
const blocked = [];
const candidateKeys = new Set();

for (const record of independentDiscoveries) {
  if (!identityReady(record) || !isIndependent(record)) {
    blocked.push({ outletKey: record.outlet_key, discoveryLane: 'independent_source_first', reason: !identityReady(record) ? 'identity_not_ready' : 'independent_source_missing' });
    continue;
  }
  candidates.push(candidateFrom(record, observationByOutlet.get(record.outlet_key), 'independent_source_first'));
  candidateKeys.add(record.outlet_key);
}

for (const corroboration of corroborations) {
  const outletKey = corroboration.outlet_key;
  if (candidateKeys.has(outletKey)) continue;
  if (!identityReady(corroboration) || !isIndependent(corroboration)) {
    blocked.push({ outletKey, discoveryLane: 'research_then_corroboration', reason: !identityReady(corroboration) ? 'identity_not_ready' : 'independent_source_missing' });
    continue;
  }
  const research = observationByOutlet.get(outletKey);
  const normalized = {
    ...corroboration,
    brand_name: research?.outlet?.brand_name,
    outlet_name: research?.outlet?.outlet_name,
  };
  candidates.push(candidateFrom(normalized, research, 'research_then_corroboration'));
  candidateKeys.add(outletKey);
}

candidates.sort((a, b) => Number(b.operationalStatus === 'ready_for_merchant_outreach') - Number(a.operationalStatus === 'ready_for_merchant_outreach') ||
  String(a.comuna ?? '').localeCompare(String(b.comuna ?? ''), 'es') || String(a.brandName ?? '').localeCompare(String(b.brandName ?? ''), 'es'));

const brandLevelMenus = menus.filter((menu) => !menu.outlet_key && menu.brand_name).map((menu) => ({
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
    independentSourceFirst: candidates.filter((item) => item.discoveryLane === 'independent_source_first').length,
    readyForMerchantOutreach: candidates.filter((item) => item.operationalStatus === 'ready_for_merchant_outreach').length,
    withIndependentMenuEvidence: candidates.filter((item) => item.independentlyObservedMenus.length > 0).length,
    blocked: blocked.length,
    unboundBrandMenus: brandLevelMenus.length,
  },
  candidates,
  blocked,
  brandLevelMenus,
}, null, 2));
