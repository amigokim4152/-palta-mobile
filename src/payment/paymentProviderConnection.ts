export type PaymentProviderEnvironment = 'sandbox' | 'production';

export type PaymentProviderConnectionStatus =
  | 'draft'
  | 'pending_credentials'
  | 'ready_for_test'
  | 'testing'
  | 'connected'
  | 'error'
  | 'paused';

export type PaymentProviderConnection = {
  id: string;
  businessId: string;
  providerKey: string;
  environment: PaymentProviderEnvironment;
  status: PaymentProviderConnectionStatus;
  /** Opaque secret-store reference only. Never an access token or private key. */
  credentialRef?: string;
  merchantRef?: string;
  capabilities: Record<string, boolean>;
  safeConfiguration: Record<string, string | number | boolean | null>;
  revision: number;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export function paymentConnectionCanPerformExternalOperation(
  connection: PaymentProviderConnection,
): boolean {
  return (
    (connection.status === 'ready_for_test' ||
      connection.status === 'testing' ||
      connection.status === 'connected') &&
    typeof connection.credentialRef === 'string' &&
    connection.credentialRef.trim().length > 0
  );
}

export function assertPaymentProviderConnection(
  connection: PaymentProviderConnection,
): void {
  if (!connection.id.trim() || !connection.businessId.trim() || !connection.providerKey.trim()) {
    throw new Error('Payment provider connection identity fields are required.');
  }
  if (!Number.isSafeInteger(connection.revision) || connection.revision < 0) {
    throw new Error('Payment provider connection revision must be a non-negative safe integer.');
  }
  if (
    connection.credentialRef !== undefined &&
    (connection.credentialRef.includes('Bearer ') || connection.credentialRef.length > 512)
  ) {
    throw new Error('credentialRef must be an opaque secret reference, not raw credential material.');
  }
}
