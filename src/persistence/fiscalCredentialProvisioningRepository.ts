import type { FiscalCredentialEnvelope } from '../fiscal/chile/fiscalCredentialEnvelope.js';
import type { FiscalProviderConnection } from '../fiscal/chile/fiscalProviderConnection.js';

export type FiscalCredentialProvisioningCommit = {
  connection: FiscalProviderConnection;
  envelope: FiscalCredentialEnvelope;
  expectedConnectionRevision: number;
};

export type FiscalCredentialProvisioningResult = {
  connection: FiscalProviderConnection;
  envelope: FiscalCredentialEnvelope;
};

/** Encrypted envelope + connection activation must commit or roll back together. */
export interface FiscalCredentialProvisioningRepository {
  provisionNewCredential(
    commit: FiscalCredentialProvisioningCommit,
  ): Promise<FiscalCredentialProvisioningResult>;
}

export class FiscalCredentialProvisioningError extends Error {
  constructor(message = 'Fiscal credential provisioning failed atomically.') {
    super(message);
    this.name = 'FiscalCredentialProvisioningError';
  }
}
