import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const cardPath = path.join(root, 'mobile-overlay/src/components/LocalResultCard.tsx');
const ownerCardPath = path.join(root, 'mobile-overlay/src/components/business/OwnerPartnerCard.tsx');
const discoveryPath = path.join(root, 'mobile-overlay/src/features/business/BusinessDiscoveryExperience.tsx');
const detailPath = path.join(root, 'mobile-overlay/src/features/business/BusinessProfileExperience.tsx');
const ownerHomePath = path.join(root, 'mobile-overlay/src/app/business/manage/[businessId].tsx');
const liveReferencePath = path.join(root, 'mobile-overlay/src/features/business/BusinessReferenceScreen.tsx');
const sampleRoutePath = path.join(root, 'mobile-overlay/src/app/dev/local-business-samples.tsx');
const previewPath = path.join(root, 'src/business/localBusinessDiscoveryPreview.ts');
const referencePath = path.join(root, 'docs/LOCAL_BUSINESS_SCREEN_REFERENCE_V1.md');
const handoffPath = path.join(root, 'docs/LOCAL_BUSINESS_DESIGN_SYSTEM_HANDOFF.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readTsx(file) {
  assert(fs.existsSync(file), `Missing source: ${path.relative(root, file)}`);
  const source = fs.readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
    },
  });
  const errors = (result.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert(
    errors.length === 0,
    `${path.relative(root, file)} has syntax errors: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join(' | ')}`,
  );
  return source;
}

const card = readTsx(cardPath);
const ownerCard = readTsx(ownerCardPath);
const discovery = readTsx(discoveryPath);
const detail = readTsx(detailPath);
const ownerHome = readTsx(ownerHomePath);
const liveReference = readTsx(liveReferencePath);
const sampleRoute = readTsx(sampleRoutePath);
const preview = readTsx(previewPath);

assert(fs.existsSync(referencePath), 'Local Business screen reference must exist.');
assert(fs.existsSync(handoffPath), 'Local Business design-system handoff must exist.');

assert(
  card.includes('imageUrl?: string') &&
  card.includes('serviceLabels?: readonly string[]') &&
  card.includes('highlight?: string'),
  'Discovery rows must remain ready for a real image, useful service labels and one current highlight.',
);
assert(
  card.includes("status === 'Abierto ahora'") &&
  card.includes('distance') &&
  card.includes("width: '100%'"),
  'Discovery rows must make current operating truth and distance/service context scannable at full sheet width.',
);
assert(
  card.includes('firstLetter(name)') && card.includes('accessibilityLabel={`Foto de ${name}`}'),
  'Discovery rows must gracefully fall back when no real business photo exists.',
);
assert(
  card.includes('consumerMetaLabel') &&
  card.includes("value.includes('_')") &&
  card.includes('categoryLabels'),
  'Consumer rows must retain a defensive last-line guard against raw taxonomy keys.',
);
assert(
  card.includes('✓ Verificado') && card.includes("value !== 'Verificado'"),
  'Verification must stay a compact trust cue rather than consume the discovery highlight slot.',
);

assert(
  discovery.includes('NeighborhoodMap') &&
  discovery.includes('MapResultSheet') &&
  discovery.includes('Buscar en esta zona') &&
  discovery.includes("position: 'absolute', top: 0, right: 0, bottom: 0, left: 0") &&
  !discovery.includes("useState<'list' | 'map'>"),
  'Canonical Negocios must remain a polished full-map experience with an edge-to-edge result sheet.',
);
assert(
  discovery.includes('preview: readLocalBusinessDiscoveryPreview(item)') &&
  discovery.includes('localBusinessConsumerCategoryLabel(item.category_key)') &&
  discovery.includes('imageUrl={item.preview.photoUrl}') &&
  discovery.includes('serviceLabels={serviceLabels}') &&
  discovery.includes('highlight={item.preview.highlight?.label}') &&
  !discovery.includes('function discoveryVisual'),
  'Discovery must feed production result rows from the bounded canonical preview rather than parse transport fields in the screen.',
);
assert(
  preview.includes('readLocalBusinessDiscoveryPreview') &&
  preview.includes("kind: 'coupon' | 'post' | 'unknown'") &&
  preview.includes('safePublicPhoto') &&
  preview.includes('MAX_SERVICE_LABELS = 2'),
  'Canonical preview must keep media safe, services bounded and highlight provenance explicit when known.',
);

const heroIndex = detail.indexOf('<ProfileHero');
const actionsIndex = detail.indexOf('<BusinessActionBar');
const servicesIndex = detail.indexOf('title="Qué hace este negocio"');
const hoursIndex = detail.indexOf('title="Horario y atención"');
const couponIndex = detail.indexOf('title="Beneficio disponible"');
const postsIndex = detail.indexOf('title="Novedades"');
const reviewsIndex = detail.indexOf('title="Opiniones verificadas"');
const externalIndex = detail.indexOf('<ExternalChannels');
assert(heroIndex >= 0, 'Business profile must begin with a visual business hero.');
assert(actionsIndex > heroIndex, 'Primary business actions must appear immediately after the hero.');
assert(servicesIndex > actionsIndex, 'Service detail must follow immediate actions.');
assert(hoursIndex === -1 || hoursIndex > servicesIndex, 'Hours and service area must follow service identity.');
assert(couponIndex === -1 || couponIndex > Math.max(actionsIndex, hoursIndex), 'Benefits must remain below services/hours.');
assert(postsIndex === -1 || postsIndex > Math.max(actionsIndex, couponIndex), 'Recent updates must remain below direct actions and benefits.');
assert(reviewsIndex === -1 || reviewsIndex > Math.max(actionsIndex, postsIndex), 'Verified reviews must remain supporting content.');
assert(externalIndex > actionsIndex, 'External channels belong below primary Palta actions.');
assert(
  detail.includes('.slice(0, 6)') && detail.includes('pagingEnabled'),
  'Profile hero must preserve a bounded swipeable real-photo gallery.',
);
assert(
  detail.includes('business.posts.slice(0, 3)') && detail.includes('reviews.items.slice(0, 3)'),
  'Profile should progressively disclose useful updates and verified-use reviews.',
);
assert(
  detail.includes('readLocalBusinessDiscoveryCache') &&
  detail.includes("return 'Zona de atención'") &&
  detail.includes('formatDistance(item.distance_m)'),
  'Profile must carry discovery context without persisting precise search location.',
);

assert(
  ownerCard.includes('OwnerPartnerCardTone') &&
  ownerCard.includes("'attention'") &&
  ownerCard.includes("'success'"),
  'Owner Partner Home and its reference sample must share one themed status card component.',
);
const ownerTodayIndex = ownerHome.indexOf('title="Tu negocio ahora"');
const ownerFreeIndex = ownerHome.indexOf('title="Mantén tu presencia útil"');
const ownerAutomationIndex = ownerHome.indexOf('title="Automatiza sólo si te ahorra trabajo"');
assert(ownerTodayIndex >= 0, 'Owner home must begin with today/current operating truth.');
assert(ownerFreeIndex > ownerTodayIndex, 'Free profile-management tools must sit below current operating work.');
assert(ownerAutomationIndex === -1 || ownerAutomationIndex > ownerFreeIndex, 'Optional automation must stay below free management tools.');
assert(
  ownerHome.includes('/services') && ownerHome.includes('/location') && ownerHome.includes('/channels'),
  'Owner free-base management must expose services, location/service area and public links from the same canonical business.',
);
assert(
  ownerHome.includes('guidanceTargetKind') &&
  ownerHome.includes('openGuidanceTarget') &&
  ownerHome.includes('onPress={targetKind'),
  'Owner guidance must open only implemented management surfaces.',
);

assert(
  liveReference.includes('<LocalResultCard') &&
  liveReference.includes('<BusinessActionBar') &&
  liveReference.includes('<OwnerPartnerCard'),
  'The live screen reference must reuse production components.',
);
assert(
  liveReference.includes('Muestra A · resultado de búsqueda') &&
  liveReference.includes('Muestra B · primera vista del perfil') &&
  liveReference.includes('Muestra C · Mi negocio'),
  'The live reference must keep discovery, profile and owner-home samples visible.',
);
assert(
  sampleRoute.includes('BusinessReferenceScreen') && !sampleRoute.includes('<LocalResultCard'),
  'The dev sample route must reuse the canonical BusinessReferenceScreen rather than duplicate sample UI.',
);

console.log('PASS: Local Business full-map screen reference with canonical discovery preview');
