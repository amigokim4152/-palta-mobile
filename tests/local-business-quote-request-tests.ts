import {
  projectQuoteComparison,
  selectQuoteBusiness,
  validateBusinessQuoteRequest,
  validateBusinessQuoteResponse,
  type BusinessQuoteRequest,
  type BusinessQuoteResponse,
} from '../src/business/businessQuoteRequest.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const request: BusinessQuoteRequest = {
  id: 'quote-1',
  requesterUserId: 'user-1',
  description: 'Necesito reparar una fuga bajo el lavaplatos y revisar la llave.',
  recipientBusinessIds: ['biz-1', 'biz-2'],
  serviceTaxonomyIds: ['plumbing'],
  status: 'collecting',
  createdAt: '2026-09-17T14:00:00-03:00',
  serviceAreaId: 'vitacura',
};

assert(validateBusinessQuoteRequest(request).length === 0, 'valid quote request should pass');
assert(
  validateBusinessQuoteRequest({ ...request, recipientBusinessIds: [] }).includes('quote_recipient_required'),
  'quote request needs at least one recipient',
);
assert(
  validateBusinessQuoteRequest({
    ...request,
    recipientBusinessIds: Array.from({ length: 11 }, (_, index) => `biz-${index}`),
  }).includes('quote_recipient_limit_exceeded'),
  'quote fan-out must stay bounded',
);

const responses: BusinessQuoteResponse[] = [
  {
    id: 'response-1',
    quoteRequestId: 'quote-1',
    businessId: 'biz-1',
    status: 'submitted',
    submittedAt: '2026-09-17T14:10:00-03:00',
    amountClp: 45000,
    note: 'Incluye visita y mano de obra.',
    validUntil: '2026-09-20T23:59:59-03:00',
  },
  {
    id: 'response-2',
    quoteRequestId: 'quote-1',
    businessId: 'biz-2',
    status: 'submitted',
    submittedAt: '2026-09-17T14:05:00-03:00',
    amountClp: 38000,
    note: 'Materiales aparte si hay que cambiar la llave.',
    validUntil: '2026-09-20T23:59:59-03:00',
  },
  {
    id: 'response-expired',
    quoteRequestId: 'quote-1',
    businessId: 'biz-2',
    status: 'submitted',
    submittedAt: '2026-09-16T14:00:00-03:00',
    amountClp: 1000,
    validUntil: '2026-09-17T13:00:00-03:00',
  },
];

for (const response of responses) {
  assert(validateBusinessQuoteResponse(response).length === 0, `response ${response.id} should validate`);
}

const comparison = projectQuoteComparison({
  request,
  responses,
  now: '2026-09-17T15:00:00-03:00',
});
assert(comparison.length === 2, 'expired responses should not be compared');
assert(comparison[0]?.businessId === 'biz-2', 'comparison should sort known lower amount first');
assert(comparison[1]?.businessId === 'biz-1', 'second valid quote should remain visible');

const selected = selectQuoteBusiness(request, 'biz-2');
assert(selected.status === 'selected', 'selection should advance quote request state');
assert(selected.selectedBusinessId === 'biz-2', 'selection should preserve chosen canonical Business id');

let invalidSelectionRejected = false;
try {
  selectQuoteBusiness(request, 'biz-not-requested');
} catch {
  invalidSelectionRejected = true;
}
assert(invalidSelectionRejected, 'user must not select a business that did not receive the quote request');

console.log('PASS: Local Business quote request and comparison contract');
