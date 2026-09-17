import {
  sealFiscalCredentials,
  type FiscalCredentialBundle,
} from '../../adapters/secrets/envelopeFiscalSecretStore.js';
import type { CredentialKekProvider } from '../../adapters/secrets/credentialEnvelopeCrypto.js';
import type { FiscalCredentialProvisioningRepository } from '../../persistence/fiscalCredentialProvisioningRepository.js';
import {
  provisionFiscalCredentialReference,
  type FiscalProviderConnection,
} from './fiscalProviderConnection.js';

export type FiscalCredentialProvisioningIds = {
  envelopeId(): string;
  credentialRef(): string;
};

export type ProvisionFiscalCredentialsInput = {
  connection: FiscalProviderConnection;
  bundle: FiscalCredentialBundle;
  occurredAt: string;
};

/**
 * Initial external-DTE credential onboarding. Raw provider credentials exist
 * only in memory long enough to encrypt under a per-credential DEK/current KEK.
 */
export class FiscalConnectionProvisioningService {
  constructor(
    private readonly repository: FiscalCredentialProvisioningRepository,
    private readonly keks: CredentialKekProvider,
    private readonly ids: FiscalCredentialProvisioningIds,
    private readonly cryptoImpl: Crypto = globalThis.crypto,
  ) {}

  async provision(input: ProvisionFiscalCredentialsInput) {
    const credentialRef = this.ids.credentialRef();
    if (!credentialRef.trim()) throw new Error('Generated fiscal credential reference is empty.');

    const nextConnection = provisionFiscalCredentialReference(input.connection, {
      credentialRef,
      occurredAt: input.occurredAt,
    });
    const kek = await this.keks.current();
    const envelope = await sealFiscalCredentials({
      id: this.ids.envelopeId(),
      identity: {
        businessId: nextConnection.businessId,
        providerConnectionId: nextConnection.id,
        providerKey: nextConnection.providerKey,
        issuerRut: nextConnection.issuerRut,
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
