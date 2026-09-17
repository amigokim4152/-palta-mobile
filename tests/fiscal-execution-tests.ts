import {
  applyExternalFiscalProviderResult,
  createFiscalExecution,
  fiscalExecutionNeedsReconciliation,
  transitionFiscalExecution,
} from '../src/fiscal/chile/fiscalExecution.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const created = createFiscalExecution({
  id: '11111111-1111-4111-8111-111111111111',
  businessId: '22222222-2222-4222-8222-222222222222',
  fiscalRequestId: '33333333-3333-4333-8333-333333333333',
  issuerRut: '76123456-7',
  documentType: 'boleta_39',
  mode: 'external_provider',
  environment: 'certification',
  idempotencyKey: 'fiscal-execution-1',
  providerKey: 'dte_comges',
  providerConnectionId: '44444444-4444-4444-8444-444444444444',
  createdAt: '2026-09-17T18:30:00.000Z',
});
assert(created.status === 'created' && created.revision === 0, 'New fiscal execution must start created at revision zero.');

const submitting = transitionFiscalExecution(created, 'submitting', '2026-09-17T18:30:01.000Z');
assert(submitting.revision === 1, 'Persist-before-side-effect submitting transition must consume one revision.');
assert(fiscalExecutionNeedsReconciliation('submitting'), 'Submitting is an uncertain side-effect boundary and must reconcile on redelivery.');

const queued = applyExternalFiscalProviderResult(
  submitting,
  {
    providerKey: 'dte_comges',
    status: 'queued',
    providerStatus: 'Pendiente',
    queueTicketReference: 'ticket-1',
  },
  '2026-09-17T18:30:02.000Z',
);
assert(queued.status === 'queued' && queued.providerTicketReference === 'ticket-1', '202 response must persist queue ticket evidence.');
assert(queued.revision === 2, 'Provider result must advance execution revision exactly once.');

const accepted = applyExternalFiscalProviderResult(
  queued,
  {
    providerKey: 'dte_comges',
    status: 'accepted',
    providerStatus: 'Aceptado',
    providerReference: 'doc-1',
    queueTicketReference: 'ticket-1',
    folio: 1001,
    authorityTrackId: 'track-1',
    authorityStatus: 'Aceptado',
    xmlUrl: 'asset://xml/doc-1',
    pdfUrl: 'asset://pdf/doc-1',
    providerTotals: {
      netAmountMinor: 37815,
      exemptAmountMinor: 0,
      vatAmountMinor: 7185,
      totalAmountMinor: 45000,
    },
    canonicalTotalsMatch: true,
  },
  '2026-09-17T18:30:03.000Z',
);
assert(accepted.status === 'accepted' && accepted.folio === 1001, 'Accepted execution must retain definitive folio.');
assert(accepted.providerReference === 'doc-1' && accepted.authorityTrackId === 'track-1', 'Accepted execution must preserve provider/SII evidence.');
assert(accepted.canonicalTotalsMatch === true, 'Canonical/provider total comparison evidence must be preserved.');

const replayed = applyExternalFiscalProviderResult(
  accepted,
  {
    providerKey: 'dte_comges',
    status: 'accepted',
    providerStatus: 'Aceptado',
    providerReference: 'doc-1',
    queueTicketReference: 'ticket-1',
    folio: 1001,
    authorityTrackId: 'track-1',
    authorityStatus: 'Aceptado',
    xmlUrl: 'asset://xml/doc-1',
    pdfUrl: 'asset://pdf/doc-1',
    providerTotals: {
      netAmountMinor: 37815,
      exemptAmountMinor: 0,
      vatAmountMinor: 7185,
      totalAmountMinor: 45000,
    },
    canonicalTotalsMatch: true,
  },
  '2026-09-17T18:30:04.000Z',
);
assert(replayed === accepted, 'Identical provider reconciliation result must not consume another canonical revision.');

let providerReferenceMutationBlocked = false;
try {
  applyExternalFiscalProviderResult(
    accepted,
    {
      providerKey: 'dte_comges',
      status: 'accepted',
      providerStatus: 'Aceptado',
      providerReference: 'different-doc',
      queueTicketReference: 'ticket-1',
      folio: 1001,
    },
    '2026-09-17T18:30:05.000Z',
  );
} catch {
  providerReferenceMutationBlocked = true;
}
assert(providerReferenceMutationBlocked, 'One canonical fiscal execution must never silently switch provider document identity.');

let acceptedWithoutEvidenceBlocked = false;
try {
  applyExternalFiscalProviderResult(
    submitting,
    {
      providerKey: 'dte_comges',
      status: 'accepted',
      providerStatus: 'Aceptado',
    },
    '2026-09-17T18:30:06.000Z',
  );
} catch {
  acceptedWithoutEvidenceBlocked = true;
}
assert(acceptedWithoutEvidenceBlocked, 'Accepted external execution without provider document ID/folio must be rejected.');

console.log('PASS: fiscal execution state/evidence safety tests');
