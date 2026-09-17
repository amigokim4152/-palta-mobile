import type { PaymentProviderConnection } from '../payment/paymentProviderConnection.js';

export type PaymentProviderConnectionLookup = {
  businessId: string;
  connectionId: string;
  providerKey: string;
};

export type PaymentProviderConnectionWrite = {
  connection: PaymentProviderConnection;
  expectedRevision: number | null;
};

export interface PaymentProviderConnectionRepository {
  findConnection(
    lookup: PaymentProviderConnectionLookup,
  ): Promise<PaymentProviderConnection | null>;
  saveConnection(
    write: PaymentProviderConnectionWrite,
  ): Promise<PaymentProviderConnection>;
}

export class PaymentProviderConnectionConcurrencyError extends Error {
  constructor(message = 'Payment provider connection revision conflict.') {
    super(message);
    this.name = 'PaymentProviderConnectionConcurrencyError';
  }
}
