import type { PaymentProviderConnection } from '../payment/paymentProviderConnection.js';

export type PaymentProviderConnectionLookup = {
  businessId: string;
  connectionId: string;
  providerKey: string;
};

export interface PaymentProviderConnectionRepository {
  findConnection(
    lookup: PaymentProviderConnectionLookup,
  ): Promise<PaymentProviderConnection | null>;
}
