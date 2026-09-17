import type { PaymentCredentialEnvelope } from '../payment/paymentCredentialEnvelope.js';
import type { PaymentProviderConnection } from '../payment/paymentProviderConnection.js';

export type PaymentCredentialProvisioningCommit = {
  connection: PaymentProviderConnection;
  envelope: PaymentCredentialEnvelope;
  expectedConnectionRevision: number;
};

export type PaymentCredentialProvisioningResult = {
  connection: PaymentProviderConnection;
  envelope: PaymentCredentialEnvelope;
};

/**
 * Initial credential provisioning boundary. The encrypted credential row and
 * provider connection's credentialRef/status must commit or roll back together.
 */
export interface PaymentCredentialProvisioningRepository {
  provisionNewCredential(
    commit: PaymentCredentialProvisioningCommit,
  ): Promise<PaymentCredentialProvisioningResult>;
}

export class PaymentCredentialProvisioningError extends Error {
  constructor(message = 'Payment credential provisioning failed atomically.') {
    super(message);
    this.name = 'PaymentCredentialProvisioningError';
  }
}
