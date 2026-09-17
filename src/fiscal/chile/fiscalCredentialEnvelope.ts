export const FISCAL_CREDENTIAL_ALGORITHM = 'AES-256-GCM' as const;

export type FiscalCredentialEnvelope = {
  id: string;
  businessId: string;
  providerConnectionId: string;
  providerKey: string;
  issuerRut: string;
  credentialRef: string;
  algorithm: typeof FISCAL_CREDENTIAL_ALGORITHM;
  ciphertext: Uint8Array;
  dataIv: Uint8Array;
  wrappedDataKey: Uint8Array;
  wrapIv: Uint8Array;
  kekId: string;
  aadVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type FiscalCredentialIdentity = Pick<
  FiscalCredentialEnvelope,
  'businessId' | 'providerConnectionId' | 'providerKey' | 'issuerRut' | 'credentialRef'
>;

export function fiscalCredentialDataAad(
  identity: FiscalCredentialIdentity,
  aadVersion: number,
): Uint8Array {
  return new TextEncoder().encode(
    [
      'palta-fiscal-credential',
      `v${aadVersion}`,
      identity.businessId,
      identity.issuerRut,
      identity.providerKey,
      identity.providerConnectionId,
      identity.credentialRef,
    ].join('|'),
  );
}

export function fiscalCredentialWrapAad(
  identity: FiscalCredentialIdentity,
  aadVersion: number,
  kekId: string,
): Uint8Array {
  return new TextEncoder().encode(
    [
      'palta-fiscal-dek-wrap',
      `v${aadVersion}`,
      kekId,
      identity.businessId,
      identity.issuerRut,
      identity.providerKey,
      identity.providerConnectionId,
      identity.credentialRef,
    ].join('|'),
  );
}

export function assertFiscalCredentialEnvelope(envelope: FiscalCredentialEnvelope): void {
  if (
    !envelope.id.trim() ||
    !envelope.businessId.trim() ||
    !envelope.providerConnectionId.trim() ||
    !envelope.providerKey.trim() ||
    !envelope.issuerRut.trim() ||
    !envelope.credentialRef.trim() ||
    !envelope.kekId.trim()
  ) {
    throw new Error('Encrypted fiscal credential identity fields are required.');
  }
  if (envelope.algorithm !== FISCAL_CREDENTIAL_ALGORITHM) {
    throw new Error(`Unsupported fiscal credential algorithm: ${envelope.algorithm}`);
  }
  if (envelope.dataIv.byteLength !== 12 || envelope.wrapIv.byteLength !== 12) {
    throw new Error('AES-GCM fiscal credential IVs must be 12 bytes.');
  }
  if (envelope.ciphertext.byteLength < 16 || envelope.wrappedDataKey.byteLength < 16) {
    throw new Error('Encrypted fiscal credential payload is malformed.');
  }
  if (!Number.isSafeInteger(envelope.aadVersion) || envelope.aadVersion <= 0) {
    throw new Error('Fiscal credential AAD version must be a positive integer.');
  }
  if (!Number.isSafeInteger(envelope.revision) || envelope.revision < 0) {
    throw new Error('Fiscal credential revision must be a non-negative safe integer.');
  }
}
