import {
  PAYMENT_CREDENTIAL_ALGORITHM,
  assertPaymentCredentialEnvelope,
  paymentCredentialDataAad,
  paymentCredentialWrapAad,
  type PaymentCredentialEnvelope,
  type PaymentCredentialIdentity,
} from '../../payment/paymentCredentialEnvelope.js';
import type {
  PaymentCredentialEnvelopeRepository,
} from '../../persistence/paymentCredentialEnvelopeRepository.js';
import type {
  PaymentSecretLookup,
  PaymentSecretStore,
} from '../../ports/paymentSecretStore.js';

export type CredentialKek = {
  id: string;
  key: CryptoKey;
};

/**
 * Key-encryption-key boundary. Runtime implementations may import a small number
 * of master keys from Cloudflare Secrets Store, KMS, HSM or another provider.
 * Merchant credentials themselves are never stored there one-by-one.
 */
export interface CredentialKekProvider {
  current(): Promise<CredentialKek>;
  byId(id: string): Promise<CredentialKek | null>;
}

export type PaymentCredentialBundle = Record<string, string>;

function randomIv(cryptoImpl: Crypto): Uint8Array {
  const iv = new Uint8Array(12);
  cryptoImpl.getRandomValues(iv);
  return iv;
}

function assertCredentialBundle(bundle: PaymentCredentialBundle): void {
  const entries = Object.entries(bundle);
  if (entries.length === 0) throw new Error('Payment credential bundle cannot be empty.');
  for (const [key, value] of entries) {
    if (!key.trim() || !value.trim()) {
      throw new Error('Payment credential bundle keys and values must be non-empty strings.');
    }
  }
}

async function aesGcmEncrypt(input: {
  cryptoImpl: Crypto;
  key: CryptoKey;
  iv: Uint8Array;
  aad: Uint8Array;
  plaintext: Uint8Array;
}): Promise<Uint8Array> {
  const encrypted = await input.cryptoImpl.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: input.iv,
      additionalData: input.aad,
      tagLength: 128,
    },
    input.key,
    input.plaintext,
  );
  return new Uint8Array(encrypted);
}

async function aesGcmDecrypt(input: {
  cryptoImpl: Crypto;
  key: CryptoKey;
  iv: Uint8Array;
  aad: Uint8Array;
  ciphertext: Uint8Array;
}): Promise<Uint8Array> {
  const decrypted = await input.cryptoImpl.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: input.iv,
      additionalData: input.aad,
      tagLength: 128,
    },
    input.key,
    input.ciphertext,
  );
  return new Uint8Array(decrypted);
}

function parseCredentialBundle(bytes: Uint8Array): PaymentCredentialBundle {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Decrypted payment credential bundle is malformed.');
  }
  const result: PaymentCredentialBundle = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      throw new Error(`Decrypted payment credential ${key} is not a string.`);
    }
    result[key] = value;
  }
  assertCredentialBundle(result);
  return result;
}

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
  assertCredentialBundle(input.bundle);
  const cryptoImpl = input.cryptoImpl ?? globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new Error('Web Crypto is required for payment credential encryption.');
  const aadVersion = input.aadVersion ?? 1;

  const dataKey = await cryptoImpl.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const rawDataKey = new Uint8Array(await cryptoImpl.subtle.exportKey('raw', dataKey));
  const dataIv = randomIv(cryptoImpl);
  const wrapIv = randomIv(cryptoImpl);

  try {
    const ciphertext = await aesGcmEncrypt({
      cryptoImpl,
      key: dataKey,
      iv: dataIv,
      aad: paymentCredentialDataAad(input.identity, aadVersion),
      plaintext: new TextEncoder().encode(JSON.stringify(input.bundle)),
    });
    const wrappedDataKey = await aesGcmEncrypt({
      cryptoImpl,
      key: input.kek.key,
      iv: wrapIv,
      aad: paymentCredentialWrapAad(input.identity, aadVersion, input.kek.id),
      plaintext: rawDataKey,
    });

    const envelope: PaymentCredentialEnvelope = {
      id: input.id,
      ...input.identity,
      algorithm: PAYMENT_CREDENTIAL_ALGORITHM,
      ciphertext,
      dataIv,
      wrappedDataKey,
      wrapIv,
      kekId: input.kek.id,
      aadVersion,
      revision: input.revision,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    };
    assertPaymentCredentialEnvelope(envelope);
    return envelope;
  } finally {
    rawDataKey.fill(0);
  }
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
  const cryptoImpl = input.cryptoImpl ?? globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new Error('Web Crypto is required for payment credential decryption.');
  const identity: PaymentCredentialIdentity = {
    businessId: input.envelope.businessId,
    providerConnectionId: input.envelope.providerConnectionId,
    providerKey: input.envelope.providerKey,
    credentialRef: input.envelope.credentialRef,
  };

  const rawDataKey = await aesGcmDecrypt({
    cryptoImpl,
    key: input.kek.key,
    iv: input.envelope.wrapIv,
    aad: paymentCredentialWrapAad(
      identity,
      input.envelope.aadVersion,
      input.envelope.kekId,
    ),
    ciphertext: input.envelope.wrappedDataKey,
  });
  try {
    const dataKey = await cryptoImpl.subtle.importKey(
      'raw',
      rawDataKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plaintext = await aesGcmDecrypt({
      cryptoImpl,
      key: dataKey,
      iv: input.envelope.dataIv,
      aad: paymentCredentialDataAad(identity, input.envelope.aadVersion),
      ciphertext: input.envelope.ciphertext,
    });
    try {
      return parseCredentialBundle(plaintext);
    } finally {
      plaintext.fill(0);
    }
  } finally {
    rawDataKey.fill(0);
  }
}

/**
 * Read path used by payment-provider factories. Contextual lookup prevents an
 * opaque credentialRef from acting as an authorization token.
 */
export class EnvelopePaymentSecretStore implements PaymentSecretStore {
  constructor(
    private readonly envelopes: PaymentCredentialEnvelopeRepository,
    private readonly keks: CredentialKekProvider,
    private readonly cryptoImpl: Crypto = globalThis.crypto,
  ) {}

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
