export type PaymentSecretLookup = {
  credentialRef: string;
  key: string;
};

/**
 * Minimal secret boundary for payment-provider factories.
 * Implementations may use Cloudflare secrets, an external vault or another
 * secret manager. Secret values must never be persisted into canonical DB rows,
 * Queue payloads, events, logs or errors.
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
