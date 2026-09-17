export const PAYMENT_CREDENTIAL_ALGORITHM = 'AES-256-GCM' as const;

export type PaymentCredentialEnvelope = {
  id: string;
  businessId: string;
  providerConnectionId: string;
  providerKey: string;
  credentialRef: string;
  algorithm: typeof PAYMENT_CREDENTIAL_ALGORITHM;
  /** Encrypted JSON credential bundle. Never plaintext. */
  ciphertext: Uint8Array;
  dataIv: Uint8Array;
  /** Per-credential random data-encryption key wrapped by an external KEK. */
  wrappedDataKey: Uint8Array;
  wrapIv: Uint8Array;
  kekId: string;
  aadVersion: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export type PaymentCredentialIdentity = Pick<
  PaymentCredentialEnvelope,
  'businessId' | 'providerConnectionId' | 'providerKey' | 'credentialRef'
>;

export function paymentCredentialDataAad(
  identity: PaymentCredentialIdentity,
  aadVersion: number,
): Uint8Array {
  return new TextEncoder().encode(
    [
      'palta-payment-credential',
      `v${aadVersion}`,
      identity.businessId,
      identity.providerKey,
      identity.providerConnectionId,
      identity.credentialRef,
    ].join('|'),
  );
}

export function paymentCredentialWrapAad(
  identity: PaymentCredentialIdentity,
  aadVersion: number,
  kekId: string,
): Uint8Array {
  return new TextEncoder().encode(
    [
      'palta-payment-dek-wrap',
      `v${aadVersion}`,
      kekId,
      identity.businessId,
      identity.providerKey,
      identity.providerConnectionId,
      identity.credentialRef,
    ].join('|'),
  );
}

export function assertPaymentCredentialEnvelope(
  envelope: PaymentCredentialEnvelope,
): void {
  if (
    !envelope.id.trim() ||
    !envelope.businessId.trim() ||
    !envelope.providerConnectionId.trim() ||
    !envelope.providerKey.trim() ||
    !envelope.credentialRef.trim() ||
    !envelope.kekId.trim()
  ) {
    throw new Error('Encrypted payment credential identity fields are required.');
  }
  if (envelope.algorithm !== PAYMENT_CREDENTIAL_ALGORITHM) {
    throw new Error(`Unsupported payment credential algorithm: ${envelope.algorithm}`);
  }
  if (envelope.dataIv.byteLength !== 12 || envelope.wrapIv.byteLength !== 12) {
    throw new Error('AES-GCM payment credential IVs must be 12 bytes.');
  }
  if (envelope.ciphertext.byteLength < 16 || envelope.wrappedDataKey.byteLength < 16) {
    throw new Error('Encrypted payment credential payload is malformed.');
  }
  if (!Number.isSafeInteger(envelope.aadVersion) || envelope.aadVersion <= 0) {
    throw new Error('Payment credential AAD version must be a positive integer.');
  }
  if (!Number.isSafeInteger(envelope.revision) || envelope.revision < 0) {
    throw new Error('Payment credential revision must be a non-negative safe integer.');
  }
}
