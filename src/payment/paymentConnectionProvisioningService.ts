import {
  sealPaymentCredentials,
  type CredentialKekProvider,
  type PaymentCredentialBundle,
} from '../adapters/secrets/envelopePaymentSecretStore.js';
import type { PaymentCredentialProvisioningRepository } from '../persistence/paymentCredentialProvisioningRepository.js';
import {
  provisionPaymentCredentialReference,
  type PaymentProviderConnection,
} from './paymentProviderConnection.js';

export type PaymentCredentialProvisioningIds = {
  envelopeId(): string;
  credentialRef(): string;
};

export type ProvisionPaymentCredentialsInput = {
  connection: PaymentProviderConnection;
  bundle: PaymentCredentialBundle;
  merchantRef?: string;
  occurredAt: string;
};

/**
 * Initial provider credential onboarding:
 * 1. generate opaque credential identity
 * 2. encrypt raw credential bundle under per-credential DEK/current KEK
 * 3. build the one-revision pending_credentials -> ready_for_test connection
 * 4. atomically persist encrypted envelope + connection credentialRef/status
 *
 * Plaintext credentials are never written into connection, event or queue data.
 */
export class PaymentConnectionProvisioningService {
  constructor(
    private readonly repository: PaymentCredentialProvisioningRepository,
    private readonly keks: CredentialKekProvider,
    private readonly ids: PaymentCredentialProvisioningIds,
    private readonly cryptoImpl: Crypto = globalThis.crypto,
  ) {}

  async provision(input: ProvisionPaymentCredentialsInput) {
    const credentialRef = this.ids.credentialRef();
    if (!credentialRef.trim()) throw new Error('Generated payment credential reference is empty.');

    const nextConnection = provisionPaymentCredentialReference(input.connection, {
      credentialRef,
      occurredAt: input.occurredAt,
      ...(input.merchantRef === undefined ? {} : { merchantRef: input.merchantRef }),
    });
    const kek = await this.keks.current();
    const envelope = await sealPaymentCredentials({
      id: this.ids.envelopeId(),
      identity: {
        businessId: nextConnection.businessId,
        providerConnectionId: nextConnection.id,
        providerKey: nextConnection.providerKey,
        credentialRef,
      },
      bundle: input.bundle,
      kek,
      revision: 0,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
      cryptoImpl: this.cryptoImpl,
    });

    return this.repository.provisionNewCredential({
      connection: nextConnection,
      envelope,
      expectedConnectionRevision: input.connection.revision,
    });
  }
}
