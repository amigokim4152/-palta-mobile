import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const files = [
  'mobile-overlay/src/app/business/[businessId].tsx',
  'mobile-overlay/src/app/business/[businessId]/report.tsx',
  'mobile-overlay/src/app/business/manage/[businessId].tsx',
  'mobile-overlay/src/app/business/manage/[businessId]/corrections.tsx',
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
  assert(fs.existsSync(file), `Missing correction UI source: ${relativeFile}`);
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
const report = readChecked(files[1]);
const owner = readChecked(files[2]);
const ownerCorrections = readChecked(files[3]);

assert(
  detail.includes('/report') && detail.includes('¿Ves información incorrecta?'),
  'Business detail must expose a consumer correction path.',
);
assert(
  report.includes('mobileRuntime.client.corrections.submitBusinessCorrection') &&
  report.includes('no cambia automáticamente'),
  'Consumer correction flow must submit a review signal without promising automatic mutation.',
);
assert(
  owner.includes('/corrections') && owner.includes('Información por revisar'),
  'Mi negocio must expose the owner correction queue.',
);
assert(
  ownerCorrections.includes('mobileRuntime.client.corrections.getOwnerBusinessCorrections') &&
  ownerCorrections.includes('no cambia tu perfil automáticamente'),
  'Owner corrections screen must read the queue and keep manual review explicit.',
);
assert(
  !ownerCorrections.includes('acceptCorrection') && !ownerCorrections.includes('autoApply'),
  'Owner correction UI must not invent an automatic fact-application path.',
);

console.log('PASS: Local Business correction UI source check');
