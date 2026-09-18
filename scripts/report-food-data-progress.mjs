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

const research = load('food-observations-');
const corroborations = load('outlet-corroborations-');
const independent = load('independent-outlet-discoveries-');
const menus = load('menu-corroborations-');
const overlays = new Map(corroborations.map((record) => [record.outlet_key, record]));
const independentKeys = new Set(independent.map((record) => record.outlet_key));

const statusCounts = {};
for (const record of corroborations) statusCounts[record.identity_status] = (statusCounts[record.identity_status] ?? 0) + 1;
for (const record of independent) statusCounts[`independent_${record.identity_status}`] = (statusCounts[`independent_${record.identity_status}`] ?? 0) + 1;

const researchItems = research.flatMap((record) => record.menu_snapshot?.sample_items ?? []);
const independentMenuItems = menus.flatMap((record) => record.items ?? []);
const pricedIndependentMenuItems = independentMenuItems.filter((item) =>
  Number.isFinite(item.price_clp) || Number.isFinite(item.price_min_clp) || Number.isFinite(item.price_max_clp));

const effectiveContacts = [];
for (const record of research) {
  const outlet = record.outlet ?? {};
  const overlay = overlays.get(outlet.outlet_key) ?? {};
  effectiveContacts.push({
    outletKey: outlet.outlet_key,
    phone: overlay.public_contact?.phone ?? outlet.public_contact?.phone,
    whatsapp: overlay.public_contact?.whatsapp ?? outlet.public_contact?.whatsapp,
    status: overlay.identity_status ?? outlet.identity_status,
  });
}
for (const record of independent) {
  if (effectiveContacts.some((item) => item.outletKey === record.outlet_key)) continue;
  effectiveContacts.push({
    outletKey: record.outlet_key,
    phone: record.public_contact?.phone,
    whatsapp: record.public_contact?.whatsapp,
    status: record.identity_status,
  });
}

const identityReady = effectiveContacts.filter((item) => item.status === 'verified' || item.status === 'corroborated');
const identityReview = effectiveContacts.filter((item) => item.status === 'needs_review' || item.status === 'possible_virtual_brand');
const directContactReady = identityReady.filter((item) => item.whatsapp || item.phone);

const menuOutletKeys = new Set(menus.map((record) => record.outlet_key).filter(Boolean));
const menuBrands = new Set(menus.map((record) => record.brand_name).filter(Boolean));
const researchComunas = new Set(research.map((record) => record.outlet?.comuna).filter(Boolean));
const independentComunas = new Set(independent.map((record) => record.comuna).filter(Boolean));
const allComunas = new Set([...researchComunas, ...independentComunas]);

console.log(JSON.stringify({
  dataset: 'palta_food_data_progress_rm',
  generatedAt: new Date().toISOString(),
  policy: {
    collectImages: false,
    livePublishRequiresMerchantAuthorization: true,
    deliveryPlatformResearchIsNotProduction: true,
  },
  coverage: {
    researchOutlets: research.length,
    researchSampledMenuItems: researchItems.length,
    independentSourceFirstOutlets: independent.length,
    independentCorroborationOverlays: corroborations.length,
    uniqueComunasWithAnyData: allComunas.size,
  },
  identity: {
    statuses: statusCounts,
    identityReady: identityReady.length,
    identityNeedsReview: identityReview.length,
  },
  outreach: {
    directPhone: effectiveContacts.filter((item) => item.phone).length,
    explicitWhatsapp: effectiveContacts.filter((item) => item.whatsapp).length,
    identityReadyWithDirectPhoneOrWhatsapp: directContactReady.length,
    note: 'No messages are sent by this report. Shared Messaging Core owns future send actions.',
  },
  independentMenus: {
    records: menus.length,
    outletBoundRecords: menus.filter((record) => record.outlet_key).length,
    brandLevelRecords: menus.filter((record) => !record.outlet_key && record.brand_name).length,
    uniqueOutletBindings: menuOutletKeys.size,
    uniqueBrandMenus: menuBrands.size,
    factualItems: independentMenuItems.length,
    itemsWithObservedPrice: pricedIndependentMenuItems.length,
  },
  safeguards: {
    imagesCollectedByPipeline: 0,
    merchantAuthorizationRecords: 0,
    livePublishAllowedBeforeAuthorization: false,
    independentSourceFirstKeys: independentKeys.size,
  },
}, null, 2));
