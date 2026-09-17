import type {
  PaymentCredentialEnvelope,
  PaymentCredentialIdentity,
} from '../payment/paymentCredentialEnvelope.js';

export type PaymentCredentialEnvelopeLookup = PaymentCredentialIdentity;

export type PaymentCredentialEnvelopeWrite = {
  envelope: PaymentCredentialEnvelope;
  expectedRevision: number | null;
};

export interface PaymentCredentialEnvelopeRepository {
  findEnvelope(
    lookup: PaymentCredentialEnvelopeLookup,
  ): Promise<PaymentCredentialEnvelope | null>;
  saveEnvelope(write: PaymentCredentialEnvelopeWrite): Promise<PaymentCredentialEnvelope>;
}

export class PaymentCredentialConcurrencyError extends Error {
  constructor(message = 'Payment credential envelope revision conflict.') {
    super(message);
    this.name = 'PaymentCredentialConcurrencyError';
  }
}
