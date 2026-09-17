import {
  FISCAL_CREDENTIAL_ALGORITHM,
  assertFiscalCredentialEnvelope,
  fiscalCredentialDataAad,
  fiscalCredentialWrapAad,
  type FiscalCredentialEnvelope,
  type FiscalCredentialIdentity,
} from '../../fiscal/chile/fiscalCredentialEnvelope.js';
import type { FiscalCredentialEnvelopeRepository } from '../../persistence/fiscalCredentialEnvelopeRepository.js';
import type { FiscalSecretLookup, FiscalSecretStore } from '../../ports/fiscalSecretStore.js';
import {
  openCredentialBundle,
  sealCredentialBundle,
  type CredentialBundle,
  type CredentialKek,
  type CredentialKekProvider,
} from './credentialEnvelopeCrypto.js';

export type FiscalCredentialBundle = CredentialBundle;

export type WriteFiscalCredentialBundleInput = {
  id: string;
  identity: FiscalCredentialIdentity;
  bundle: FiscalCredentialBundle;
  expectedRevision: number | null;
  occurredAt: string;
};

export async function sealFiscalCredentials(input: {
  id: string;
  identity: FiscalCredentialIdentity;
  bundle: FiscalCredentialBundle;
  kek: CredentialKek;
  revision: number;
  createdAt: string;
  updatedAt: string;
  aadVersion?: number;
  cryptoImpl?: Crypto;
}): Promise<FiscalCredentialEnvelope> {
  const aadVersion = input.aadVersion ?? 1;
  const sealed = await sealCredentialBundle({
    bundle: input.bundle,
    kek: input.kek,
    dataAad: fiscalCredentialDataAad(input.identity, aadVersion),
    wrapAad: fiscalCredentialWrapAad(input.identity, aadVersion, input.kek.id),
    ...(input.cryptoImpl === undefined ? {} : { cryptoImpl: input.cryptoImpl }),
  });
  const envelope: FiscalCredentialEnvelope = {
    id: input.id,
    ...input.identity,
    algorithm: FISCAL_CREDENTIAL_ALGORITHM,
    ...sealed,
    kekId: input.kek.id,
    aadVersion,
    revision: input.revision,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
  assertFiscalCredentialEnvelope(envelope);
  return envelope;
}

export async function openFiscalCredentials(input: {
  envelope: FiscalCredentialEnvelope;
  kek: CredentialKek;
  cryptoImpl?: Crypto;
}): Promise<FiscalCredentialBundle> {
  assertFiscalCredentialEnvelope(input.envelope);
  if (input.kek.id !== input.envelope.kekId) {
    throw new Error('Fiscal credential KEK identity mismatch.');
  }
  const identity: FiscalCredentialIdentity = {
    businessId: input.envelope.businessId,
    providerConnectionId: input.envelope.providerConnectionId,
    providerKey: input.envelope.providerKey,
    issuerRut: input.envelope.issuerRut,
    credentialRef: input.envelope.credentialRef,
  };
  return openCredentialBundle({
    ciphertext: input.envelope.ciphertext,
    dataIv: input.envelope.dataIv,
    wrappedDataKey: input.envelope.wrappedDataKey,
    wrapIv: input.envelope.wrapIv,
    kek: input.kek,
    dataAad: fiscalCredentialDataAad(identity, input.envelope.aadVersion),
    wrapAad: fiscalCredentialWrapAad(identity, input.envelope.aadVersion, input.envelope.kekId),
    ...(input.cryptoImpl === undefined ? {} : { cryptoImpl: input.cryptoImpl }),
  });
}

export class EnvelopeFiscalSecretStore implements FiscalSecretStore {
  constructor(
    private readonly envelopes: FiscalCredentialEnvelopeRepository,
    private readonly keks: CredentialKekProvider,
    private readonly cryptoImpl: Crypto = globalThis.crypto,
  ) {}

  async writeBundle(input: WriteFiscalCredentialBundleInput): Promise<FiscalCredentialEnvelope> {
    const current = input.expectedRevision === null
      ? null
      : await this.envelopes.findEnvelope(input.identity);

    if (input.expectedRevision !== null) {
      if (!current) throw new Error('Fiscal credential to rotate was not found.');
      if (current.id !== input.id) {
        throw new Error('Fiscal credential rotation cannot change canonical envelope ID.');
      }
      if (current.revision !== input.expectedRevision) {
        throw new Error('Fiscal credential rotation revision mismatch.');
      }
    }

    const kek = await this.keks.current();
    const envelope = await sealFiscalCredentials({
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

  async readSecret(lookup: FiscalSecretLookup): Promise<string | null> {
    const envelope = await this.envelopes.findEnvelope({
      businessId: lookup.businessId,
      providerConnectionId: lookup.providerConnectionId,
      providerKey: lookup.providerKey,
      issuerRut: lookup.issuerRut,
      credentialRef: lookup.credentialRef,
    });
    if (!envelope) return null;

    const kek = await this.keks.byId(envelope.kekId);
    if (!kek) throw new Error(`Fiscal credential KEK ${envelope.kekId} is unavailable.`);
    const bundle = await openFiscalCredentials({
      envelope,
      kek,
      cryptoImpl: this.cryptoImpl,
    });
    return bundle[lookup.key] ?? null;
  }
}
