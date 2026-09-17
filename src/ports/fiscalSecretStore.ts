export type FiscalSecretLookup = {
  businessId: string;
  issuerRut: string;
  providerKey: string;
  providerConnectionId: string;
  credentialRef: string;
  key: string;
};

/**
 * Backend-only secret lookup. Browser/mobile never receive provider credentials.
 */
export interface FiscalSecretStore {
  readSecret(lookup: FiscalSecretLookup): Promise<string | null>;
}
