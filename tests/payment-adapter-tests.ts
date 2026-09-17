import {
  MercadoPagoPointAdapter,
  classifyMercadoPagoHttpFailure,
  mapMercadoPagoPointStatus,
  type JsonHttpClient,
  type JsonHttpResponse,
} from '../src/adapters/payments/mercadoPagoPointAdapter.js';
import {
  TransbankPosIntegratedAdapter,
  type TransbankPosTransport,
} from '../src/adapters/payments/transbankPosIntegratedAdapter.js';
import { PaymentProviderOperationError } from '../src/payment/paymentIncident.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

type CapturedRequest = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  body?: unknown;
};

class QueueHttpClient implements JsonHttpClient {
  readonly requests: CapturedRequest[] = [];
  private readonly responses: Array<JsonHttpResponse<unknown>>;

  constructor(responses: Array<JsonHttpResponse<unknown>>) {
    this.responses = [...responses];
  }

  async request<T>(input: CapturedRequest): Promise<JsonHttpResponse<T>> {
    this.requests.push(input);
    const response = this.responses.shift();
    if (!response) throw new Error('No queued HTTP response.');
    return response as JsonHttpResponse<T>;
  }
}

assert(mapMercadoPagoPointStatus('created') === 'pending', 'Mercado Pago created must map to pending.');
assert(mapMercadoPagoPointStatus('at_terminal') === 'processing', 'Mercado Pago at_terminal must map to processing.');
assert(mapMercadoPagoPointStatus('processed') === 'paid', 'Mercado Pago processed must map to paid.');
assert(mapMercadoPagoPointStatus('action_required') === 'requires_action', 'Mercado Pago action_required must route to operator action.');
assert(mapMercadoPagoPointStatus('failed') === 'failed', 'Mercado Pago failed must not be fabricated as paid or cancelled.');
assert(mapMercadoPagoPointStatus('mystery') === 'unknown', 'Unknown provider state must remain unknown.');
assert(
  classifyMercadoPagoHttpFailure(409, { code: 'already_queued_order_for_terminal' }) === 'terminal_busy',
  'Mercado Pago terminal-busy conflict must not become a generic payment failure.',
);
assert(
  classifyMercadoPagoHttpFailure(409, { code: 'idempotency_key_already_used' }) === 'idempotency_conflict',
  'Mercado Pago idempotency conflict must be surfaced as an integrity incident.',
);
assert(
  classifyMercadoPagoHttpFailure(500, {}) === 'transient_provider_error',
  'Mercado Pago 5xx must preserve same-operation retry semantics.',
);

const http = new QueueHttpClient([
  {
    status: 201,
    body: {
      id: 'ORD-1',
      status: 'created',
      status_detail: 'created',
      transactions: { payments: [{ id: 'PAY-1', status: 'created' }] },
    },
  },
  {
    status: 200,
    body: {
      id: 'ORD-1',
      status: 'processed',
      status_detail: 'processed',
      transactions: { payments: [{ id: 'PAY-1', status: 'processed', status_detail: 'accredited' }] },
    },
  },
  {
    status: 201,
    body: {
      id: 'ORD-1',
      status: 'refunded',
      status_detail: 'refunded',
      transactions: { payments: [{ id: 'PAY-1', status: 'refunded' }] },
    },
  },
]);

const adapter = new MercadoPagoPointAdapter(http, async () => 'secret-test-token');
const originalPaymentInput = {
  canonicalPaymentId: 'pay:canonical/1',
  canonicalCommerceTransactionId: 'tx-1',
  canonicalOrderId: 'order-1',
  canonicalMerchantId: 'merchant-1',
  amount: { currency: 'CLP', amountMinor: 45000 },
  rail: 'card' as const,
  idempotencyKey: 'idem-1',
  terminalId: 'NEWLAND_N950__TEST0001',
  description: 'Jardinería',
};
const created = await adapter.createPayment(originalPaymentInput);
assert(created.providerReference === 'ORD-1' && created.status === 'pending', 'Created Point order must remain pending until provider confirms payment.');
assert(created.providerPaymentId === 'PAY-1', 'Provider payment ID should be retained for refunds and reconciliation.');

const createRequest = http.requests[0];
assert(createRequest?.url.endsWith('/v1/orders'), 'Mercado Pago Point must use Orders API.');
assert(createRequest?.headers['X-Idempotency-Key'] === 'idem-1', 'Provider request must reuse canonical idempotency key.');
const createBody = createRequest?.body as {
  external_reference?: string;
  transactions?: { payments?: Array<{ amount?: string }> };
  config?: { point?: { terminal_id?: string } };
};
assert(createBody.external_reference === 'pay_canonical_1', 'External reference must be provider-safe and non-PII.');
assert(createBody.transactions?.payments?.[0]?.amount === '45000', 'CLP amount must be sent as integer string.');
assert(createBody.config?.point?.terminal_id === 'NEWLAND_N950__TEST0001', 'Point order must target the selected terminal.');
assert(!JSON.stringify(createRequest).includes('secret-test-token') || createRequest?.headers.Authorization === 'Bearer secret-test-token', 'Token may only exist in the outbound Authorization header.');

const paid = await adapter.getStatus('ORD-1');
assert(paid.status === 'paid', 'Processed/accredited Point order must become canonical paid.');

const refunded = await adapter.refund({
  providerReference: 'ORD-1',
  idempotencyKey: 'refund-1',
});
assert(refunded.status === 'refunded', 'Successful full refund must map to canonical refunded.');
const refundRequest = http.requests[2];
assert(refundRequest?.url.endsWith('/v1/orders/ORD-1/refund'), 'Refund must target the provider order.');
assert(refundRequest?.headers['X-Idempotency-Key'] === 'refund-1', 'Refund must be idempotent.');

const recoveryHttp = new QueueHttpClient([
  {
    status: 201,
    body: {
      id: 'ORD-RECOVERED',
      status: 'processed',
      status_detail: 'processed',
      transactions: { payments: [{ id: 'PAY-RECOVERED', status: 'processed', status_detail: 'accredited' }] },
    },
  },
]);
const recoveryAdapter = new MercadoPagoPointAdapter(recoveryHttp, async () => 'secret-test-token');
const recovered = await recoveryAdapter.reconcilePayment(originalPaymentInput);
assert(
  recovered.providerReference === 'ORD-RECOVERED' && recovered.status === 'paid',
  'Mercado Pago response-loss recovery may replay the exact create operation with the same idempotency identity.',
);
assert(
  recoveryHttp.requests[0]?.headers['X-Idempotency-Key'] === originalPaymentInput.idempotencyKey,
  'Mercado Pago reconciliation without provider reference must reuse the original idempotency key.',
);

const busyHttp = new QueueHttpClient([
  { status: 409, body: { code: 'already_queued_order_for_terminal', message: 'terminal busy' } },
]);
const busyAdapter = new MercadoPagoPointAdapter(busyHttp, async () => 'secret-test-token');
let busyClassified = false;
try {
  await busyAdapter.createPayment({ ...originalPaymentInput, idempotencyKey: 'idem-busy' });
} catch (error) {
  busyClassified =
    error instanceof PaymentProviderOperationError &&
    error.incident.kind === 'terminal_busy' &&
    error.incident.recovery === 'operator_check_terminal';
}
assert(busyClassified, 'Mercado Pago queued-terminal conflict must route to terminal resolution, not blind retry.');

let reconciledTicket = '';
const transbankTransport: TransbankPosTransport = {
  kind: 'serial_sdk',
  supportsRefund: false,
  async sale() {
    throw new Error('Simulated lost sale response');
  },
  async status(reference) {
    return { reference, status: 'unknown' };
  },
  async reconcileSale(input) {
    reconciledTicket = input.ticketNumber;
    return {
      reference: 'TBK-LAST-SALE-1',
      status: 'approved',
      authorizationCode: '123456',
      responseCode: '0',
    };
  },
};
const transbankAdapter = new TransbankPosIntegratedAdapter(transbankTransport);
let transbankUnknown = false;
try {
  await transbankAdapter.createPayment({
    canonicalPaymentId: 'pay-tbk-001',
    canonicalCommerceTransactionId: 'tx-tbk-1',
    canonicalOrderId: 'order-tbk-1',
    canonicalMerchantId: 'merchant-1',
    amount: { currency: 'CLP', amountMinor: 25000 },
    rail: 'card',
    idempotencyKey: 'tbk-idem-1',
    terminalId: 'POS-1',
  });
} catch (error) {
  transbankUnknown =
    error instanceof PaymentProviderOperationError &&
    error.incident.kind === 'outcome_unknown';
}
assert(transbankUnknown, 'Lost Transbank sale response must become outcome_unknown, not failed.');
const transbankRecovered = await transbankAdapter.reconcilePayment({
  canonicalPaymentId: 'pay-tbk-001',
  canonicalCommerceTransactionId: 'tx-tbk-1',
  canonicalOrderId: 'order-tbk-1',
  canonicalMerchantId: 'merchant-1',
  amount: { currency: 'CLP', amountMinor: 25000 },
  rail: 'card',
  idempotencyKey: 'tbk-idem-1',
  terminalId: 'POS-1',
});
assert(
  transbankRecovered.status === 'paid' && reconciledTicket === 'pay-tbk-001',
  'Transbank response-loss recovery must use the canonical ticket identity before any replacement sale.',
);

console.log('PASS: Mercado Pago / Transbank payment adapter reliability tests');
