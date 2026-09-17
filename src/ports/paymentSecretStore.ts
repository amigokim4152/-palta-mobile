export type PaymentSecretLookup = {
  businessId: string;
  providerKey: string;
  providerConnectionId: string;
  credentialRef: string;
  key: string;
};

/**
 * Minimal secret boundary for payment-provider factories.
 * Implementations may use an envelope-encrypted credential vault, Supabase
 * Vault, Cloudflare Secrets Store for platform-level keys, or another secret
 * manager. Secret values must never be persisted into canonical DB rows, Queue
 * payloads, events, logs or errors.
 *
 * The business/provider/connection context is mandatory even when credentialRef
 * looks globally unique. Opaque references are locators, not authorization.
 */
export interface PaymentSecretStore {
  readSecret(lookup: PaymentSecretLookup): Promise<string | null>;
}

export class PaymentSecretUnavailableError extends Error {
  constructor(message = 'Required payment provider secret is unavailable.') {
    super(message);
    this.name = 'PaymentSecretUnavailableError';
  }
}
