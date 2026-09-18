import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const routePath = path.join(root, 'mobile-overlay/src/app/business/[businessId].tsx');
const detailPath = path.join(root, 'mobile-overlay/src/features/business/BusinessProfileExperience.tsx');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function relativeImportExists(fromFile, specifier) {
  const absoluteBase = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    absoluteBase,
    `${absoluteBase}.ts`,
    `${absoluteBase}.tsx`,
    `${absoluteBase}.js`,
    `${absoluteBase}.mjs`,
    path.join(absoluteBase, 'index.ts'),
    path.join(absoluteBase, 'index.tsx'),
    path.join(absoluteBase, 'index.js'),
  ];
  return candidates.some((candidate) => fs.existsSync(candidate));
}

function checkTsx(file) {
  assert(fs.existsSync(file), `Missing Local Business mobile source: ${path.relative(root, file)}`);
  const source = fs.readFileSync(file, 'utf8');
  const transpiled = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.Preserve,
    },
  });
  const errors = (transpiled.diagnostics ?? []).filter(
    (diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error,
  );
  assert(
    errors.length === 0,
    `${path.relative(root, file)} has TypeScript/TSX syntax errors: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join(' | ')}`,
  );

  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) continue;
    assert(
      relativeImportExists(file, specifier.text),
      `${path.relative(root, file)} has unresolved relative import: ${specifier.text}`,
    );
  }
  return source;
}

const route = checkTsx(routePath);
const detail = checkTsx(detailPath);

assert(
  route.includes('BusinessProfileExperience') && route.includes('export default BusinessProfileExperience'),
  'Business detail route must remain a thin wrapper around the canonical polished profile experience.',
);
assert(
  detail.includes('buildWhatsappUrl') && detail.includes('https://wa.me/'),
  'Business profile must open a real WhatsApp destination when available.',
);
assert(
  detail.includes('buildPhoneUrl') && detail.includes('tel:'),
  'Business profile must open a real phone destination when available.',
);
assert(
  detail.includes('.slice(0, 6)') &&
    detail.includes('horizontal') &&
    detail.includes('pagingEnabled') &&
    detail.includes('business.photo_urls'),
  'Free Business Profile must keep up to six canonical photos horizontally browsable in the hero.',
);
assert(
  detail.includes('mobileRuntime.client.getBusinessRelationship') &&
    detail.includes('mobileRuntime.client.updateBusinessRelationship'),
  'Business profile must preserve save/follow relationship behavior.',
);
assert(
  detail.includes('mobileRuntime.client.reviews.getBusinessReviews') &&
    detail.includes('Opiniones verificadas') &&
    !detail.includes('review.verified_interaction'),
  'Business profile must render only the already-public verified-interaction review projection.',
);
assert(
  detail.includes('Atención verificada') && detail.includes('review.evidence_label'),
  'Business profile must explain why a review is treated as verified interaction.',
);
assert(
  detail.includes('Messaging Core compartido') &&
    !detail.includes('new Map<string,') &&
    !detail.includes('messageStore'),
  'Local Business inquiry must keep the Shared Messaging Core boundary and avoid local message storage.',
);

console.log('PASS: Local Business polished mobile detail source check');
