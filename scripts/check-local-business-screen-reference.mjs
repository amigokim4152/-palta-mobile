import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const cardPath = path.join(root, 'mobile-overlay/src/components/LocalResultCard.tsx');
const discoveryPath = path.join(root, 'mobile-overlay/src/features/business/BusinessDiscoveryExperience.tsx');
const detailPath = path.join(root, 'mobile-overlay/src/features/business/BusinessProfileExperience.tsx');
const liveReferencePath = path.join(root, 'mobile-overlay/src/features/business/BusinessReferenceScreen.tsx');
const sampleRoutePath = path.join(root, 'mobile-overlay/src/app/dev/local-business-samples.tsx');
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
const discovery = readTsx(discoveryPath);
const detail = readTsx(detailPath);
const liveReference = readTsx(liveReferencePath);
const sampleRoute = readTsx(sampleRoutePath);
assert(fs.existsSync(referencePath), 'Local Business screen reference must exist.');
assert(fs.existsSync(handoffPath), 'Local Business design-system handoff must exist.');

assert(
  card.includes('imageUrl?: string') &&
  card.includes('serviceLabels?: readonly string[]') &&
  card.includes('highlight?: string'),
  'Discovery card must remain ready for one real image, up to two service labels and one current highlight.',
);
assert(
  card.includes("status === 'Abierto ahora'") && card.includes('distance'),
  'Discovery card must make current operating truth and distance/service context scannable.',
);
assert(
  card.includes('firstLetter(name)') && card.includes('accessibilityLabel={`Foto de ${name}`}'),
  'Discovery card must gracefully fall back when no real business photo exists instead of inventing stock imagery.',
);
assert(
  card.includes('consumerMetaLabel') &&
  card.includes("value.includes('_')") &&
  card.includes('categoryLabels'),
  'Consumer cards must translate known categories and suppress unknown internal taxonomy keys.',
);

assert(
  discovery.includes('BusinessDiscoveryShell') &&
  discovery.includes('NeighborhoodMap') &&
  discovery.includes('MapResultSheet') &&
  discovery.includes('Buscar en esta zona'),
  'Canonical Negocios must remain a polished map-led search/list experience.',
);
assert(
  discovery.includes('imageUrl={selectedVisual.imageUrl}') &&
  discovery.includes('serviceLabels={selectedVisual.serviceLabels}') &&
  discovery.includes('highlight={selectedVisual.highlight}') &&
  discovery.includes('imageUrl={visual.imageUrl}') &&
  discovery.includes('serviceLabels={visual.serviceLabels}') &&
  discovery.includes('highlight={visual.highlight}'),
  'Discovery experience must project real-photo/service/highlight slots into production result cards.',
);

const heroIndex = detail.indexOf('<ProfileHero business={business}');
const actionsIndex = detail.indexOf('<BusinessActionBar');
const servicesIndex = detail.indexOf('title="Qué hace este negocio"');
const couponIndex = detail.indexOf('title="Beneficio disponible"');
const reviewsIndex = detail.indexOf('title="Opiniones verificadas"');
const externalIndex = detail.indexOf('<ExternalChannels');
assert(heroIndex >= 0, 'Business profile must begin with a visual business hero.');
assert(actionsIndex > heroIndex, 'Primary business actions must appear immediately after the hero.');
assert(servicesIndex > actionsIndex, 'Service detail must follow immediate actions.');
assert(couponIndex === -1 || couponIndex > actionsIndex, 'Benefits must remain supporting content below direct actions.');
assert(reviewsIndex === -1 || reviewsIndex > actionsIndex, 'Verified reviews must remain supporting content below direct actions.');
assert(externalIndex > actionsIndex, 'External channels belong below primary Palta actions.');
assert(
  detail.includes('.slice(0, 6)') && detail.includes('pagingEnabled'),
  'Profile hero must preserve a bounded swipeable real-photo gallery.',
);
assert(
  detail.includes('business.posts.slice(0, 3)') && detail.includes('reviews.items.slice(0, 3)'),
  'Profile should progressively disclose useful updates and verified-use reviews instead of flooding the first viewport.',
);
assert(
  !detail.includes('Contactar y actuar') && !detail.includes('Map Core preparado'),
  'Consumer-facing polished profile must not regress to developer/prototype copy.',
);

assert(
  liveReference.includes('<LocalResultCard') && liveReference.includes('<BusinessActionBar'),
  'The live screen reference must reuse production components instead of becoming a disconnected mock design.',
);
assert(
  liveReference.includes('Muestra A · resultado de búsqueda') &&
  liveReference.includes('Muestra B · primera vista del perfil'),
  'The live reference must keep both discovery-card and profile-first-viewport samples visible to implementers.',
);
assert(
  sampleRoute.includes('BusinessReferenceScreen') && !sampleRoute.includes('<LocalResultCard'),
  'The dev sample route must reuse the canonical BusinessReferenceScreen rather than duplicate sample UI.',
);

console.log('PASS: Local Business polished screen reference');
