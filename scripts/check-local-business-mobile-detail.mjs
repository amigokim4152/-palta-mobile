import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const detailPath = path.join(root, 'mobile-overlay/src/app/business/[businessId].tsx');
const photoPath = path.join(root, 'mobile-overlay/src/components/business/BusinessPhotoStrip.tsx');

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

const detail = checkTsx(detailPath);
const photos = checkTsx(photoPath);

assert(
  detail.includes('buildWhatsappUrl') && detail.includes('https://wa.me/'),
  'Business detail must open a real WhatsApp destination when available.',
);
assert(
  detail.includes('buildPhoneUrl') && detail.includes('tel:'),
  'Business detail must open a real phone destination when available.',
);
assert(
  detail.includes('<BusinessPhotoStrip photoUrls={business.photo_urls ?? []} />'),
  'Free Business Profile must render its canonical photo URLs.',
);
assert(
  photos.includes('.slice(0, 6)') && photos.includes('horizontal'),
  'Free Business Profile photo strip must stay bounded and horizontally browsable.',
);
assert(
  detail.includes('Messaging Core compartido') && detail.includes('no crearemos un chat paralelo'),
  'Local Business inquiry must keep the Shared Messaging Core boundary explicit until the shared transport is connected.',
);

console.log('PASS: Local Business mobile detail source check');
