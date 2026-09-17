import {
  createFiscalRequest,
  type FiscalLine,
  type FiscalReceiver,
} from '../src/fiscal/chile/fiscalModel.js';
import { prepareExternalFiscalIssue } from '../src/fiscal/chile/externalFiscalPreparation.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const receiver: FiscalReceiver = {
  rut: '66666666-6',
  name: 'Consumidor final',
};

const explicitLine: FiscalLine = {
  id: 'line-1',
  description: 'Jardinería',
  quantity: 1,
  unitAmountMinor: 45000,
  lineAmountMinor: 45000,
  exempt: false,
  unitNetAmountMinor: 37815,
  unitGrossAmountMinor: 45000,
  lineNetAmountMinor: 37815,
  lineExemptAmountMinor: 0,
  lineVatAmountMinor: 7185,
  lineTotalAmountMinor: 45000,
  unitCode: 'UN',
};

const request = createFiscalRequest({
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  transactionId: '33333333-3333-4333-8333-333333333333',
  issuerRut: '76123456-7',
  documentType: 'boleta_39',
  idempotencyKey: 'fiscal-preparation-1',
  lines: [explicitLine],
  totals: {
    netAmountMinor: 37815,
    exemptAmountMinor: 0,
    vatAmountMinor: 7185,
    totalAmountMinor: 45000,
  },
  receiver,
  requestedAt: '2026-09-17T18:20:00.000Z',
});

const prepared = prepareExternalFiscalIssue(request);
assert(prepared.canonicalFiscalRequestId === request.id, 'External issue must preserve canonical FiscalRequest identity.');
assert(prepared.lines[0]?.unitNetAmountMinor === 37815, 'External issue must carry explicit net unit amount.');
assert(prepared.lines[0]?.lineExemptAmountMinor === 0, 'Affected line must carry explicit zero exempt amount.');
assert(prepared.lines[0]?.lineVatAmountMinor === 7185, 'External issue must carry explicit VAT amount.');
assert(prepared.lines[0]?.lineTotalAmountMinor === 45000, 'External issue must carry canonical gross line total.');

const legacyRequest = createFiscalRequest({
  id: '44444444-4444-4444-8444-444444444444',
  businessId: request.businessId,
  transactionId: request.transactionId,
  issuerRut: request.issuerRut,
  documentType: 'boleta_39',
  idempotencyKey: 'legacy-fiscal-preparation',
  lines: [
    {
      id: 'legacy-line',
      description: 'Legacy POS sale',
      quantity: 1,
      unitAmountMinor: 45000,
      lineAmountMinor: 45000,
      exempt: false,
    },
  ],
  totals: request.totals,
  receiver,
  requestedAt: request.requestedAt,
});
let legacyBlocked = false;
try {
  prepareExternalFiscalIssue(legacyRequest);
} catch {
  legacyBlocked = true;
}
assert(
  legacyBlocked,
  'Legacy unit/line amount fields must never be interpreted as net/gross during real external DTE issuance.',
);

const inconsistentRequest = {
  ...request,
  totals: {
    ...request.totals,
    netAmountMinor: request.totals.netAmountMinor - 1,
    vatAmountMinor: request.totals.vatAmountMinor + 1,
  },
};
let inconsistentBlocked = false;
try {
  prepareExternalFiscalIssue(inconsistentRequest);
} catch {
  inconsistentBlocked = true;
}
assert(inconsistentBlocked, 'Line tax decomposition must exactly match canonical FiscalRequest totals before provider HTTP.');

const { unitCode: _unitCode, ...withoutUnitCode } = explicitLine;
let noUnitBlocked = false;
try {
  prepareExternalFiscalIssue({ ...request, lines: [withoutUnitCode] });
} catch {
  noUnitBlocked = true;
}
assert(noUnitBlocked, 'External DTE issuance must require an explicit unit code before provider HTTP.');

const exemptRequest = createFiscalRequest({
  id: '55555555-5555-4555-8555-555555555555',
  businessId: request.businessId,
  transactionId: request.transactionId,
  issuerRut: request.issuerRut,
  documentType: 'boleta_exenta_41',
  idempotencyKey: 'exempt-fiscal-preparation',
  lines: [
    {
      id: 'exempt-line',
      description: 'Servicio exento',
      quantity: 1,
      unitAmountMinor: 10000,
      lineAmountMinor: 10000,
      exempt: true,
      unitNetAmountMinor: 0,
      unitGrossAmountMinor: 10000,
      lineNetAmountMinor: 0,
      lineExemptAmountMinor: 10000,
      lineVatAmountMinor: 0,
      lineTotalAmountMinor: 10000,
      unitCode: 'UN',
    },
  ],
  totals: {
    netAmountMinor: 0,
    exemptAmountMinor: 10000,
    vatAmountMinor: 0,
    totalAmountMinor: 10000,
  },
  receiver,
  requestedAt: request.requestedAt,
});
const preparedExempt = prepareExternalFiscalIssue(exemptRequest);
assert(
  preparedExempt.lines[0]?.lineExemptAmountMinor === 10000 &&
    preparedExempt.lines[0]?.lineVatAmountMinor === 0,
  'Provider-neutral fiscal contract must preserve exempt amount separately for future 41/34 adapters.',
);

console.log('PASS: strict external Chile fiscal preparation tests');
