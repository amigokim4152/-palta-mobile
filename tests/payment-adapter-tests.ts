import {
  MercadoPagoPointAdapter,
  mapMercadoPagoPointStatus,
  type JsonHttpClient,
  type JsonHttpResponse,
} from '../src/adapters/payments/mercadoPagoPointAdapter.js';

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
assert(mapMercadoPagoPointStatus('action_required') === 'requires_action', 'Mercado Pago action_required must remain non-terminal.');
assert(mapMercadoPagoPointStatus('failed') === 'failed', 'Mercado Pago failed must not be fabricated as paid or cancelled.');
assert(mapMercadoPagoPointStatus('mystery') === 'unknown', 'Unknown provider state must remain unknown.');

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
const created = await adapter.createPayment({
  canonicalPaymentId: 'pay:canonical/1',
  canonicalOrderId: 'order-1',
  canonicalMerchantId: 'merchant-1',
  amount: { currency: 'CLP', amountMinor: 45000 },
  rail: 'card',
  idempotencyKey: 'idem-1',
  terminalId: 'NEWLAND_N950__TEST0001',
  description: 'Jardinería',
});
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

console.log('PASS: Mercado Pago Point adapter contract tests');
