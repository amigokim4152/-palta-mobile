import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const files = [
  'mobile-overlay/src/app/business/manage/[businessId].tsx',
  'mobile-overlay/src/app/business/manage/[businessId]/hours.tsx',
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

for (const relativeFile of files) {
  const file = path.join(root, relativeFile);
  assert(fs.existsSync(file), `Missing Local Business mobile source: ${relativeFile}`);
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
    `${relativeFile} has TypeScript/TSX syntax errors: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join(' | ')}`,
  );

  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specifier)) continue;
    if (!specifier.text.startsWith('.')) continue;
    assert(
      relativeImportExists(file, specifier.text),
      `${relativeFile} has unresolved relative import: ${specifier.text}`,
    );
  }
}

const hoursSource = fs.readFileSync(path.join(root, files[1]), 'utf8');
assert(
  hoursSource.includes('mobileRuntime.client.operatingRules'),
  'Owner hours screen must use the canonical operatingRules API client.',
);
assert(
  hoursSource.includes("action: 'close_today'") &&
  hoursSource.includes("action: 'clear_today_exception'"),
  'Owner hours screen must keep today-only exceptions separate from the weekly schedule.',
);

const ownerSource = fs.readFileSync(path.join(root, files[0]), 'utf8');
assert(
  ownerSource.includes(`/business/manage/${'${encodeURIComponent(business.id)}'}/hours`),
  'Mi negocio should expose the operating-hours route.',
);

console.log('PASS: Local Business mobile hours source check');
