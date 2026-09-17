import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const profilePath = 'mobile-overlay/src/app/business/manage/[businessId]/profile.tsx';
const ownerHomePath = 'mobile-overlay/src/app/business/manage/[businessId].tsx';
const correctionsPath = 'mobile-overlay/src/app/business/manage/[businessId]/corrections.tsx';

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
  assert(fs.existsSync(file), `Missing owner profile source: ${relativeFile}`);
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

const profile = readChecked(profilePath);
const ownerHome = readChecked(ownerHomePath);
const corrections = readChecked(correctionsPath);

assert(
  profile.includes('mobileRuntime.client.ownerProfile.getOwnerProfile') &&
  profile.includes('mobileRuntime.client.ownerProfile.updateOwnerProfile'),
  'Owner profile screen must read and mutate through the canonical ownerProfile client.',
);
assert(
  profile.includes('description') && profile.includes('phone') && profile.includes('whatsapp'),
  'Free owner profile editor must cover description, phone and WhatsApp.',
);
assert(
  profile.includes('El nombre, la clasificación, los servicios y la ubicación usan controles propios'),
  'Basic profile editor must not bypass identity, taxonomy or location contracts.',
);
assert(
  ownerHome.includes('/profile') && ownerHome.includes('title="Perfil público"'),
  'Mi negocio must expose the free profile editor.',
);
assert(
  corrections.includes('Revisar contacto') && corrections.includes('/profile'),
  'Contact corrections must link to the canonical profile editor before resolution.',
);

console.log('PASS: Local Business free owner profile source check');
