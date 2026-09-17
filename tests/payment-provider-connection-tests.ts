import {
  BusinessScopedPaymentPortResolver,
  type PaymentPortFactory,
} from '../src/payment/businessScopedPaymentPortResolver.js';
import type { PaymentProviderConnection } from '../src/payment/paymentProviderConnection.js';
import type {
  PaymentProviderConnectionLookup,
  PaymentProviderConnectionRepository,
  PaymentProviderConnectionWrite,
} from '../src/persistence/paymentProviderConnectionRepository.js';
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentPort,
  ProviderPaymentStatus,
  RefundInput,
} from '../src/ports/paymentPort.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const connection: PaymentProviderConnection = {
  id: '33333333-3333-4333-8333-333333333333',
  businessId: '22222222-2222-4222-8222-222222222222',
  providerKey: 'provider-test',
  environment: 'sandbox',
  status: 'testing',
  credentialRef: 'secret://payments/business-a/provider-test',
  merchantRef: 'merchant-a',
  capabilities: { card: true },
  safeConfiguration: { country: 'CL' },
  revision: 0,
  createdAt: '2026-09-17T17:30:00.000Z',
  updatedAt: '2026-09-17T17:30:00.000Z',
};

class ConnectionRepository implements PaymentProviderConnectionRepository {
  lookups: PaymentProviderConnectionLookup[] = [];
  value: PaymentProviderConnection | null = connection;
  async findConnection(lookup: PaymentProviderConnectionLookup) {
    this.lookups.push(lookup);
    if (!this.value) return null;
    if (
      lookup.businessId !== this.value.businessId ||
      lookup.connectionId !== this.value.id ||
      lookup.providerKey !== this.value.providerKey
    ) return null;
    return this.value;
  }
  async saveConnection(write: PaymentProviderConnectionWrite) {
    this.value = write.connection;
    return write.connection;
  }
}

class Port implements PaymentPort {
  readonly providerKey = 'provider-test';
  supportsRail() { return true; }
  async createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return { providerKey: this.providerKey, providerReference: 'ref-1', status: 'paid' };
  }
  async getStatus(reference: string): Promise<ProviderPaymentStatus> {
    return { providerKey: this.providerKey, providerReference: reference, status: 'paid' };
  }
  async refund(_input: RefundInput): Promise<ProviderPaymentStatus> {
    return { providerKey: this.providerKey, providerReference: 'ref-1', status: 'refunded' };
  }
}

class Factory implements PaymentPortFactory {
  readonly providerKey = 'provider-test';
  calls = 0;
  seenConnection?: PaymentProviderConnection;
  seenTerminalId?: string;
  async create(input: { connection: PaymentProviderConnection; terminalId?: string }): Promise<PaymentPort> {
    this.calls += 1;
    this.seenConnection = input.connection;
    if (input.terminalId !== undefined) this.seenTerminalId = input.terminalId;
    return new Port();
  }
}

const repository = new ConnectionRepository();
const factory = new Factory();
const resolver = new BusinessScopedPaymentPortResolver(repository, [factory]);
const resolved = await resolver.resolve({
  businessId: connection.businessId,
  providerKey: connection.providerKey,
  providerConnectionId: connection.id,
  terminalId: 'TERM-A',
});
assert(resolved?.providerKey === 'provider-test', 'Connected business/provider connection must resolve an adapter.');
assert(factory.calls === 1, 'Provider factory must run only after connection validation.');
assert(factory.seenConnection?.credentialRef === connection.credentialRef, 'Factory receives only the canonical opaque credential reference.');
assert(factory.seenTerminalId === 'TERM-A', 'Terminal context must be preserved during provider resolution.');

const wrongBusiness = await resolver.resolve({
  businessId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  providerKey: connection.providerKey,
  providerConnectionId: connection.id,
});
assert(wrongBusiness === null, 'A provider connection from another business must never resolve.');
assert(factory.calls === 1, 'Cross-business lookup must fail before provider factory/secret resolution.');

const noConnectionId = await resolver.resolve({
  businessId: connection.businessId,
  providerKey: connection.providerKey,
});
assert(noConnectionId === null, 'Integrated provider resolution must not guess a connection when ID is absent.');
assert(factory.calls === 1, 'Missing connection identity must never reach secret/provider factory.');

repository.value = { ...connection, status: 'paused' };
const paused = await resolver.resolve({
  businessId: connection.businessId,
  providerKey: connection.providerKey,
  providerConnectionId: connection.id,
});
assert(paused === null, 'Paused payment connection must not perform external side effects.');
assert(factory.calls === 1, 'Paused connection must be rejected before provider factory creation.');

const { credentialRef: _credentialRef, ...withoutCredential } = connection;
repository.value = withoutCredential;
const noCredential = await resolver.resolve({
  businessId: connection.businessId,
  providerKey: connection.providerKey,
  providerConnectionId: connection.id,
});
assert(noCredential === null, 'Connection without credential reference must not perform external side effects.');
assert(factory.calls === 1, 'Missing credentials must be rejected before provider factory creation.');

console.log('PASS: business-scoped payment provider connection isolation tests');
