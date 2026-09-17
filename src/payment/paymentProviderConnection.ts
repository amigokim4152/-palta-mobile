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

const ALLOWED_CONNECTION_TRANSITIONS: Record<
  PaymentProviderConnectionStatus,
  readonly PaymentProviderConnectionStatus[]
> = {
  draft: ['pending_credentials', 'paused'],
  pending_credentials: ['ready_for_test', 'error', 'paused'],
  ready_for_test: ['testing', 'pending_credentials', 'error', 'paused'],
  testing: ['connected', 'ready_for_test', 'error', 'paused'],
  connected: ['testing', 'pending_credentials', 'error', 'paused'],
  error: ['pending_credentials', 'ready_for_test', 'testing', 'paused'],
  paused: ['pending_credentials', 'ready_for_test', 'testing', 'connected'],
};

/**
 * Runtime execution gate.
 *
 * Sandbox may use ready_for_test/testing/connected to support controlled
 * provider certification flows. Production is intentionally stricter: only a
 * production connection in connected state may perform an external payment
 * operation. This prevents a production worker from accidentally charging with
 * sandbox/testing credentials.
 */
export function paymentConnectionCanPerformExternalOperation(
  connection: PaymentProviderConnection,
  runtimeEnvironment: PaymentProviderEnvironment = 'sandbox',
): boolean {
  if (connection.environment !== runtimeEnvironment) return false;
  if (!connection.credentialRef?.trim()) return false;

  if (runtimeEnvironment === 'production') {
    return connection.status === 'connected';
  }

  return (
    connection.status === 'ready_for_test' ||
    connection.status === 'testing' ||
    connection.status === 'connected'
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

export function transitionPaymentProviderConnection(
  connection: PaymentProviderConnection,
  next: PaymentProviderConnectionStatus,
  occurredAt: string,
): PaymentProviderConnection {
  assertPaymentProviderConnection(connection);
  if (connection.status === next) return connection;
  if (!ALLOWED_CONNECTION_TRANSITIONS[connection.status].includes(next)) {
    throw new Error(`Invalid payment provider connection transition: ${connection.status} -> ${next}`);
  }
  if (
    (next === 'ready_for_test' || next === 'testing' || next === 'connected') &&
    !connection.credentialRef?.trim()
  ) {
    throw new Error(`Payment provider connection cannot enter ${next} without credentialRef.`);
  }
  return {
    ...connection,
    status: next,
    revision: connection.revision + 1,
    updatedAt: occurredAt,
  };
}

/**
 * Generic credential-reference update for rotation/rebinding where lifecycle
 * state should not be implicitly changed.
 */
export function attachPaymentCredentialReference(
  connection: PaymentProviderConnection,
  input: {
    credentialRef: string;
    occurredAt: string;
    merchantRef?: string;
  },
): PaymentProviderConnection {
  if (!input.credentialRef.trim() || input.credentialRef.includes('Bearer ')) {
    throw new Error('Payment credential reference must be a non-empty opaque reference.');
  }
  const withCredential: PaymentProviderConnection = {
    ...connection,
    credentialRef: input.credentialRef,
    ...(input.merchantRef === undefined ? {} : { merchantRef: input.merchantRef }),
    revision: connection.revision + 1,
    updatedAt: input.occurredAt,
  };
  assertPaymentProviderConnection(withCredential);
  return withCredential;
}

/**
 * Initial OAuth/API-credential provisioning transition. This intentionally
 * combines attaching the opaque reference and moving to ready_for_test in one
 * revision so DB provisioning can commit credential + connection atomically.
 */
export function provisionPaymentCredentialReference(
  connection: PaymentProviderConnection,
  input: {
    credentialRef: string;
    occurredAt: string;
    merchantRef?: string;
  },
): PaymentProviderConnection {
  if (connection.status !== 'pending_credentials' && connection.status !== 'error') {
    throw new Error(
      `Payment credentials can only be initially provisioned from pending_credentials/error, not ${connection.status}.`,
    );
  }
  if (!input.credentialRef.trim() || input.credentialRef.includes('Bearer ')) {
    throw new Error('Payment credential reference must be a non-empty opaque reference.');
  }
  const provisioned: PaymentProviderConnection = {
    ...connection,
    credentialRef: input.credentialRef,
    ...(input.merchantRef === undefined ? {} : { merchantRef: input.merchantRef }),
    status: 'ready_for_test',
    revision: connection.revision + 1,
    updatedAt: input.occurredAt,
  };
  assertPaymentProviderConnection(provisioned);
  return provisioned;
}

export function markPaymentConnectionVerified(
  connection: PaymentProviderConnection,
  occurredAt: string,
): PaymentProviderConnection {
  if (connection.status !== 'testing' && connection.status !== 'connected') {
    throw new Error('Only a testing/connected payment connection can be verification-stamped.');
  }
  return {
    ...connection,
    lastVerifiedAt: occurredAt,
    revision: connection.revision + 1,
    updatedAt: occurredAt,
  };
}
