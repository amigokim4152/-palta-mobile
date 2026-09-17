import {
  MercadoPagoPointAdapter,
  type JsonHttpClient,
  type JsonHttpResponse,
} from '../src/adapters/payments/mercadoPagoPointAdapter.js';
import {
  TransbankPosIntegratedAdapter,
  type TransbankPosTransport,
} from '../src/adapters/payments/transbankPosIntegratedAdapter.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class QueueHttpClient implements JsonHttpClient {
  constructor(private readonly responses: Array<JsonHttpResponse<unknown>>) {}

  async request<T>(): Promise<JsonHttpResponse<T>> {
    const response = this.responses.shift();
    if (!response) throw new Error('No queued HTTP response.');
    return response as JsonHttpResponse<T>;
  }
}

const mercadoHttp = new QueueHttpClient([
  {
    status: 201,
    body: {
      id: 'ORD-PARTIAL',
      status: 'created',
      transactions: {
        payments: [{ id: 'PAY-PARTIAL', status: 'created', amount: '10000' }],
      },
    },
  },
  {
    status: 200,
    body: {
      id: 'ORD-PARTIAL',
      status: 'processed',
      transactions: {
        payments: [{ id: 'PAY-PARTIAL', status: 'processed', amount: '6000' }],
      },
    },
  },
]);
const mercado = new MercadoPagoPointAdapter(mercadoHttp, async () => 'token');
const mercadoInput = {
  canonicalPaymentId: 'payment-partial-1',
  canonicalCommerceTransactionId: 'transaction-partial-1',
  canonicalMerchantId: 'business-1',
  amount: { currency: 'CLP', amountMinor: 10000 },
  rail: 'card' as const,
  idempotencyKey: 'idem-partial-1',
  terminalId: 'terminal-1',
};
const mercadoPending = await mercado.createPayment(mercadoInput);
assert(
  mercadoPending.status === 'pending' && mercadoPending.processedAmount === undefined,
  'Mercado Pago requested order amount must not be treated as processed evidence before paid confirmation.',
);
const mercadoPaid = await mercado.getStatus('ORD-PARTIAL');
assert(
  mercadoPaid.status === 'paid' && mercadoPaid.processedAmount?.amountMinor === 6000,
  'Mercado Pago paid response must preserve the actual provider-confirmed processed amount.',
);

const transbankTransport: TransbankPosTransport = {
  kind: 'serial_sdk',
  supportsRefund: false,
  async sale() {
    return {
      reference: 'TBK-PARTIAL',
      status: 'pending',
      amountPesos: 10000,
    };
  },
  async status(reference) {
    return {
      reference,
      status: 'approved',
      amountPesos: 6000,
      authorizationCode: 'ABC123',
    };
  },
};
const transbank = new TransbankPosIntegratedAdapter(transbankTransport);
const transbankPending = await transbank.createPayment({
  ...mercadoInput,
  canonicalPaymentId: 'payment-tbk-partial-1',
  idempotencyKey: 'idem-tbk-partial-1',
});
assert(
  transbankPending.status === 'pending' && transbankPending.processedAmount === undefined,
  'Transbank pending amount must not be treated as authoritative processed evidence.',
);
const transbankPaid = await transbank.getStatus('TBK-PARTIAL');
assert(
  transbankPaid.status === 'paid' && transbankPaid.processedAmount?.amountMinor === 6000,
  'Transbank approved result must retain the provider-confirmed processed amount when transport exposes it.',
);

console.log('PASS: provider processed amount evidence tests');
