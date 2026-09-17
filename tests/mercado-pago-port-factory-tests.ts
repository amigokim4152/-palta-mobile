import { MercadoPagoPointPortFactory } from '../src/adapters/payments/mercadoPagoPointPortFactory.js';
import type {
  JsonHttpClient,
  JsonHttpResponse,
} from '../src/adapters/payments/mercadoPagoPointAdapter.js';
import { PaymentProviderOperationError } from '../src/payment/paymentIncident.js';
import type { PaymentProviderConnection } from '../src/payment/paymentProviderConnection.js';
import type {
  PaymentSecretLookup,
  PaymentSecretStore,
} from '../src/ports/paymentSecretStore.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

class SecretStore implements PaymentSecretStore {
  lookups: PaymentSecretLookup[] = [];
  values = new Map<string, string>();
  async readSecret(lookup: PaymentSecretLookup): Promise<string | null> {
    this.lookups.push(lookup);
    return this.values.get(`${lookup.credentialRef}:${lookup.key}`) ?? null;
  }
}

class HttpClient implements JsonHttpClient {
  calls: Array<{
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  }> = [];
  async request<T>(input: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  }): Promise<JsonHttpResponse<T>> {
    this.calls.push(input);
    return {
      status: 201,
      body: {
        id: `ORDER-${this.calls.length}`,
        status: 'processed',
      } as T,
    };
  }
}

function connection(id: string, businessId: string, credentialRef: string): PaymentProviderConnection {
  return {
    id,
    businessId,
    providerKey: 'mercadopago_point',
    environment: 'sandbox',
    status: 'testing',
    credentialRef,
    capabilities: { card: true },
    safeConfiguration: {},
    revision: 0,
    createdAt: '2026-09-17T17:40:00.000Z',
    updatedAt: '2026-09-17T17:40:00.000Z',
  };
}

const secrets = new SecretStore();
secrets.values.set('secret://business-a/mp:access_token', 'TOKEN-A');
secrets.values.set('secret://business-b/mp:access_token', 'TOKEN-B');
const http = new HttpClient();
const factory = new MercadoPagoPointPortFactory(http, secrets);

const businessA = connection(
  '11111111-1111-4111-8111-111111111111',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'secret://business-a/mp',
);
const businessB = connection(
  '22222222-2222-4222-8222-222222222222',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'secret://business-b/mp',
);

const portA = await factory.create({ connection: businessA, terminalId: 'TERM-A' });
await portA.createPayment({
  canonicalPaymentId: 'pay-a',
  canonicalCommerceTransactionId: 'sale-a',
  canonicalMerchantId: businessA.businessId,
  amount: { currency: 'CLP', amountMinor: 12000 },
  rail: 'card',
  idempotencyKey: 'idem-a',
  terminalId: 'TERM-A',
});

const portB = await factory.create({ connection: businessB, terminalId: 'TERM-B' });
await portB.createPayment({
  canonicalPaymentId: 'pay-b',
  canonicalCommerceTransactionId: 'sale-b',
  canonicalMerchantId: businessB.businessId,
  amount: { currency: 'CLP', amountMinor: 18000 },
  rail: 'card',
  idempotencyKey: 'idem-b',
  terminalId: 'TERM-B',
});

assert(http.calls[0]?.headers.Authorization === 'Bearer TOKEN-A', 'Business A must use only Business A Mercado Pago secret.');
assert(http.calls[1]?.headers.Authorization === 'Bearer TOKEN-B', 'Business B must use only Business B Mercado Pago secret.');
assert(
  secrets.lookups[0]?.credentialRef === businessA.credentialRef &&
    secrets.lookups[1]?.credentialRef === businessB.credentialRef,
  'Factory must resolve secrets from each exact business connection reference.',
);
assert(
  JSON.stringify(http.calls).includes('TOKEN-A') && JSON.stringify(http.calls).includes('TOKEN-B'),
  'Test transport should receive tokens only as runtime authorization headers.',
);

const missingSecretConnection = connection(
  '33333333-3333-4333-8333-333333333333',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'secret://business-c/mp',
);
const missingPort = await factory.create({ connection: missingSecretConnection, terminalId: 'TERM-C' });
let configurationBlocked = false;
const callsBeforeMissing = http.calls.length;
try {
  await missingPort.createPayment({
    canonicalPaymentId: 'pay-c',
    canonicalCommerceTransactionId: 'sale-c',
    canonicalMerchantId: missingSecretConnection.businessId,
    amount: { currency: 'CLP', amountMinor: 9000 },
    rail: 'card',
    idempotencyKey: 'idem-c',
    terminalId: 'TERM-C',
  });
} catch (error) {
  configurationBlocked =
    error instanceof PaymentProviderOperationError &&
    error.incident.kind === 'configuration_error';
}
assert(configurationBlocked, 'Missing Mercado Pago token must be a configuration incident.');
assert(http.calls.length === callsBeforeMissing, 'No provider HTTP call may occur when business credential is missing.');

console.log('PASS: Mercado Pago business-secret isolation factory tests');
