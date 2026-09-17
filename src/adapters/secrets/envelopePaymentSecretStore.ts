import {
  PAYMENT_CREDENTIAL_ALGORITHM,
  assertPaymentCredentialEnvelope,
  paymentCredentialDataAad,
  paymentCredentialWrapAad,
  type PaymentCredentialEnvelope,
  type PaymentCredentialIdentity,
} from '../../payment/paymentCredentialEnvelope.js';
import type { PaymentCredentialEnvelopeRepository } from '../../persistence/paymentCredentialEnvelopeRepository.js';
import type { PaymentSecretLookup, PaymentSecretStore } from '../../ports/paymentSecretStore.js';
import {
  openCredentialBundle,
  sealCredentialBundle,
  type CredentialBundle,
  type CredentialKek,
  type CredentialKekProvider,
} from './credentialEnvelopeCrypto.js';

export type { CredentialKek, CredentialKekProvider } from './credentialEnvelopeCrypto.js';

export type PaymentCredentialBundle = CredentialBundle;

export type WritePaymentCredentialBundleInput = {
  id: string;
  identity: PaymentCredentialIdentity;
  bundle: PaymentCredentialBundle;
  expectedRevision: number | null;
  occurredAt: string;
};

export async function sealPaymentCredentials(input: {
  id: string;
  identity: PaymentCredentialIdentity;
  bundle: PaymentCredentialBundle;
  kek: CredentialKek;
  revision: number;
  createdAt: string;
  updatedAt: string;
  aadVersion?: number;
  cryptoImpl?: Crypto;
}): Promise<PaymentCredentialEnvelope> {
  const aadVersion = input.aadVersion ?? 1;
  const sealed = await sealCredentialBundle({
    bundle: input.bundle,
    kek: input.kek,
    dataAad: paymentCredentialDataAad(input.identity, aadVersion),
    wrapAad: paymentCredentialWrapAad(input.identity, aadVersion, input.kek.id),
    ...(input.cryptoImpl === undefined ? {} : { cryptoImpl: input.cryptoImpl }),
  });

  const envelope: PaymentCredentialEnvelope = {
    id: input.id,
    ...input.identity,
    algorithm: PAYMENT_CREDENTIAL_ALGORITHM,
    ...sealed,
    kekId: input.kek.id,
    aadVersion,
    revision: input.revision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
  assertPaymentCredentialEnvelope(envelope);
  return envelope;
}

export async function openPaymentCredentials(input: {
  envelope: PaymentCredentialEnvelope;
  kek: CredentialKek;
  cryptoImpl?: Crypto;
}): Promise<PaymentCredentialBundle> {
  assertPaymentCredentialEnvelope(input.envelope);
  if (input.kek.id !== input.envelope.kekId) {
    throw new Error('Payment credential KEK identity mismatch.');
  }
  const identity: PaymentCredentialIdentity = {
    businessId: input.envelope.businessId,
    providerConnectionId: input.envelope.providerConnectionId,
    providerKey: input.envelope.providerKey,
    credentialRef: input.envelope.credentialRef,
  };
  return openCredentialBundle({
    ciphertext: input.envelope.ciphertext,
    dataIv: input.envelope.dataIv,
    wrappedDataKey: input.envelope.wrappedDataKey,
    wrapIv: input.envelope.wrapIv,
    kek: input.kek,
    dataAad: paymentCredentialDataAad(identity, input.envelope.aadVersion),
    wrapAad: paymentCredentialWrapAad(
      identity,
      input.envelope.aadVersion,
      input.envelope.kekId,
    ),
    ...(input.cryptoImpl === undefined ? {} : { cryptoImpl: input.cryptoImpl }),
  });
}

/**
 * Encrypted merchant-credential vault. Contextual lookup prevents an opaque
 * credentialRef from acting as an authorization token. Write/rotation always
 * creates a fresh per-credential DEK and fresh IVs under the current KEK.
 */
export class EnvelopePaymentSecretStore implements PaymentSecretStore {
  constructor(
    private readonly envelopes: PaymentCredentialEnvelopeRepository,
    private readonly keks: CredentialKekProvider,
    private readonly cryptoImpl: Crypto = globalThis.crypto,
  ) {}

  async writeBundle(input: WritePaymentCredentialBundleInput): Promise<PaymentCredentialEnvelope> {
    const current = input.expectedRevision === null
      ? null
      : await this.envelopes.findEnvelope(input.identity);

    if (input.expectedRevision !== null) {
      if (!current) throw new Error('Payment credential to rotate was not found.');
      if (current.id !== input.id) {
        throw new Error('Payment credential rotation cannot change canonical envelope ID.');
      }
      if (current.revision !== input.expectedRevision) {
        throw new Error('Payment credential rotation revision mismatch.');
      }
    }

    const kek = await this.keks.current();
    const envelope = await sealPaymentCredentials({
      id: input.id,
      identity: input.identity,
      bundle: input.bundle,
      kek,
      revision: input.expectedRevision === null ? 0 : input.expectedRevision + 1,
      createdAt: current?.createdAt ?? input.occurredAt,
      updatedAt: input.occurredAt,
      cryptoImpl: this.cryptoImpl,
    });
    return this.envelopes.saveEnvelope({
      envelope,
      expectedRevision: input.expectedRevision,
    });
  }

  async readSecret(lookup: PaymentSecretLookup): Promise<string | null> {
    const envelope = await this.envelopes.findEnvelope({
      businessId: lookup.businessId,
      providerConnectionId: lookup.providerConnectionId,
      providerKey: lookup.providerKey,
      credentialRef: lookup.credentialRef,
    });
    if (!envelope) return null;

    const kek = await this.keks.byId(envelope.kekId);
    if (!kek) throw new Error(`Payment credential KEK ${envelope.kekId} is unavailable.`);
    const bundle = await openPaymentCredentials({
      envelope,
      kek,
      cryptoImpl: this.cryptoImpl,
    });
    return bundle[lookup.key] ?? null;
  }
}
