import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const detailPath = path.join(root, 'mobile-overlay/src/app/business/[businessId].tsx');
const quotePath = path.join(root, 'mobile-overlay/src/app/business/[businessId]/quote.tsx');

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

function readChecked(file) {
  assert(fs.existsSync(file), `Missing quote UI source: ${path.relative(root, file)}`);
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
    `${path.relative(root, file)} has syntax errors: ${errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join(' | ')}`,
  );

  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) continue;
    assert(relativeImportExists(file, specifier.text), `${path.relative(root, file)} has unresolved import: ${specifier.text}`);
  }
  return source;
}

const detail = readChecked(detailPath);
const quote = readChecked(quotePath);

assert(
  detail.includes("case 'quote':") && detail.includes('/quote`'),
  'Business detail quote action must open the quote request form instead of sending a placeholder request.',
);
assert(
  quote.includes("intentKey: 'local_business_quote'") &&
  quote.includes("actionType: 'quote_request'") &&
  quote.includes('recipient_business_ids: [businessId]'),
  'Quote form must create the canonical Local Business quote Care request with recipient Business ids.',
);
assert(
  quote.includes("source: 'business_profile'") && quote.includes('idempotencyKey:'),
  'Quote request must preserve source context and idempotency.',
);
assert(
  quote.includes('Shared Media') && !quote.includes('uploadPhoto') && !quote.includes('uploadImage'),
  'Quote UI must wait for Shared Media instead of creating a Local Business-only upload path.',
);
assert(
  quote.includes('cleanDescription.length < 10') && quote.includes('maxLength={2000}'),
  'Quote request must require a useful bounded description.',
);

console.log('PASS: Local Business quote request UI source check');
