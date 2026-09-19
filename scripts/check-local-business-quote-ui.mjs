import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.cwd();
const detailPath = path.join(root, 'mobile-overlay/src/features/business/BusinessProfileExperience.tsx');
const quotePath = path.join(root, 'mobile-overlay/src/app/business/[businessId]/quote.tsx');
const carePath = path.join(root, 'mobile-overlay/src/app/care/[careTrackId].tsx');
const ownerHomePath = path.join(root, 'mobile-overlay/src/app/business/manage/[businessId].tsx');
const ownerQuotePath = path.join(root, 'mobile-overlay/src/app/business/manage/[businessId]/quotes.tsx');

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
const care = readChecked(carePath);
const ownerHome = readChecked(ownerHomePath);
const ownerQuote = readChecked(ownerQuotePath);

assert(
  detail.includes("case 'quote':") && detail.includes('/quote`'),
  'Polished Business Profile quote action must open the quote request form instead of sending a placeholder request.',
);
assert(
  quote.includes('authenticatedRuntime.client.quotes.createQuoteRequest') &&
  quote.includes('recipientBusinessIds: [businessId]') &&
  quote.includes('quote.care_track_id'),
  'Quote form must use quote orchestration and navigate with the Shared Care Track returned by the server.',
);
assert(
  quote.includes('idempotencyKey:') && !quote.includes('mobileRuntime.client.createCare({'),
  'Quote request must be idempotent without client-authored duplicate Care creation.',
);
assert(
  quote.includes('Shared Media') && !quote.includes('uploadPhoto') && !quote.includes('uploadImage'),
  'Quote UI must wait for Shared Media instead of creating a Local Business-only upload path.',
);
assert(
  quote.includes('cleanDescription.length < 10') && quote.includes('maxLength={2000}'),
  'Quote request must require a useful bounded description.',
);
assert(
  care.includes('getQuoteByCareTrack') && care.includes('quote.responses.map') && care.includes('Elegir este negocio'),
  'Shared Care UI must project quote responses and allow explicit user selection.',
);
assert(
  care.includes('getBusinessAuthenticatedRuntime') &&
    care.includes('authenticatedRuntime.client.quotes.selectBusiness') &&
    care.includes('response.business_id'),
  'Quote selection must use the shared authenticated quote domain client with canonical Business ids.',
);
assert(
  ownerHome.includes('getBusinessInbox(businessId)') &&
    ownerHome.includes('pendingQuoteCount') &&
    ownerHome.includes('/quotes`'),
  'Verified owner home must surface only real quote work from the business-scoped inbox.',
);
assert(
  ownerQuote.includes('authenticatedRuntime.client.quotes.getBusinessInbox(businessId)') &&
    ownerQuote.includes('authenticatedRuntime.client.quotes.submitBusinessResponse') &&
    ownerQuote.includes('Aquí sólo ves la solicitud y la respuesta de tu propio negocio'),
  'Owner quote inbox must let the business respond while explaining the cross-business privacy boundary.',
);
assert(
  ownerQuote.includes('Monto CLP (opcional)') &&
    ownerQuote.includes('Agrega un monto o una nota antes de responder.') &&
    ownerQuote.includes('item.can_respond'),
  'Owner quote response UI must accept useful bounded input only while the request is open.',
);

console.log('PASS: Local Business user + owner quote orchestration UI source check');
