import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const cardPath = path.join(root, 'mobile-overlay/src/components/LocalResultCard.tsx');
const detailPath = path.join(root, 'mobile-overlay/src/app/business/[businessId].tsx');
const liveReferencePath = path.join(root, 'mobile-overlay/src/features/business/BusinessReferenceScreen.tsx');
const referencePath = path.join(root, 'docs/LOCAL_BUSINESS_SCREEN_REFERENCE_V1.md');

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
const detail = readTsx(detailPath);
const liveReference = readTsx(liveReferencePath);
assert(fs.existsSync(referencePath), 'Local Business screen reference must exist.');

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
  card.includes('isPublicMetaLabel') && card.includes("return !value.includes('_')"),
  'Consumer cards must suppress internal taxonomy keys instead of rendering developer identifiers.',
);

const actionIndex = detail.indexOf('title="¿Qué quieres hacer?"');
const servicesIndex = detail.indexOf('<ProfileSection title="Servicios"');
const hoursIndex = detail.indexOf('<ProfileSection title="Horario"');
const externalIndex = detail.indexOf('<ExternalChannels');
assert(actionIndex >= 0, 'Business profile must expose immediate actions near the top.');
assert(servicesIndex > actionIndex, 'Business services detail must follow the immediate action area.');
assert(hoursIndex > servicesIndex, 'Detailed hours must remain below the first-decision content.');
assert(externalIndex > hoursIndex, 'External channels belong in supporting profile detail, not above primary Palta actions.');
assert(
  detail.includes('<ProfileDecisionSummary business={business} />') &&
  detail.indexOf('<ProfileDecisionSummary business={business} />') < actionIndex,
  'Current operating/service-area summary must appear before action selection.',
);
assert(
  detail.includes('business.posts.slice(0, 3)') &&
  detail.includes('reviews.items.slice(0, 5)'),
  'Profile should progressively disclose useful updates and verified-use reviews instead of flooding the first viewport.',
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

console.log('PASS: Local Business screen reference');
