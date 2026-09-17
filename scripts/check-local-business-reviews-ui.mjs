import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const files = [
  'mobile-overlay/src/app/business/[businessId].tsx',
  'mobile-overlay/src/app/business/[businessId]/review.tsx',
  'mobile-overlay/src/app/business/manage/[businessId].tsx',
  'mobile-overlay/src/app/business/manage/[businessId]/reviews.tsx',
];

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

function readChecked(relativeFile) {
  const file = path.join(root, relativeFile);
  assert(fs.existsSync(file), `Missing review UI source: ${relativeFile}`);
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
    (item) => item.category === ts.DiagnosticCategory.Error,
  );
  assert(
    errors.length === 0,
    `${relativeFile} has syntax errors: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join(' | ')}`,
  );

  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) continue;
    assert(relativeImportExists(file, specifier.text), `${relativeFile} has unresolved import: ${specifier.text}`);
  }
  return source;
}

const detail = readChecked(files[0]);
const write = readChecked(files[1]);
const ownerHome = readChecked(files[2]);
const ownerReviews = readChecked(files[3]);

assert(
  detail.includes('getMyReviewEligibility') && detail.includes('Escribir opinión verificada'),
  'Business detail must expose review writing only through server eligibility.',
);
assert(
  detail.includes('reviewEligibility = undefined') && detail.includes('try {'),
  'Review eligibility failure must not make the public Business Profile unavailable.',
);
assert(
  write.includes('getMyReviewEligibility') &&
  write.includes('const evidence = state.data.eligibility.evidence') &&
  write.includes('evidenceReferenceId: evidence.reference_id') &&
  write.includes('evidenceKind: evidence.kind') &&
  !write.includes('evidenceReferenceId, setEvidenceReferenceId'),
  'Review writer must use server-selected evidence instead of editable evidence ids.',
);
assert(
  write.includes('Todavía no hay una atención verificada para opinar') &&
  write.includes('Ya dejaste una opinión por esta atención'),
  'Review writer must explain ineligible and duplicate states.',
);
assert(
  ownerHome.includes('/reviews') && ownerHome.includes('Opiniones verificadas') && ownerHome.includes('reviewCount > 0'),
  'Mi negocio must surface review management only when verified reviews exist.',
);
assert(
  ownerReviews.includes("business.verification_status !== 'verified'") &&
  ownerReviews.includes('replyToBusinessReview'),
  'Official Business reply UI must require a verified owner and use the review API.',
);
assert(
  ownerReviews.includes('Todavía no hay opiniones verificadas') && ownerReviews.includes('No necesitas hacer nada por ahora'),
  'Review management must stay quiet when there is no work.',
);

console.log('PASS: Local Business verified review UI source check');
