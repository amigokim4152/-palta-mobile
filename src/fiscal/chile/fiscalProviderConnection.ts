import type { ChileDteType } from './fiscalModel.js';

export type FiscalProviderEnvironment = 'certification' | 'production';
export type FiscalProviderConnectionStatus =
  | 'draft'
  | 'pending_credentials'
  | 'ready_for_test'
  | 'testing'
  | 'connected'
  | 'error'
  | 'paused';

export type FiscalProviderConnection = {
  id: string;
  businessId: string;
  issuerRut: string;
  providerKey: string;
  environment: FiscalProviderEnvironment;
  status: FiscalProviderConnectionStatus;
  credentialRef?: string;
  enabledDocumentTypes: ChileDteType[];
  safeConfiguration: Record<string, string | number | boolean | null>;
  revision: number;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
};

const TRANSITIONS: Readonly<Record<FiscalProviderConnectionStatus, readonly FiscalProviderConnectionStatus[]>> = {
  draft: ['pending_credentials', 'paused'],
  pending_credentials: ['ready_for_test', 'error', 'paused'],
  ready_for_test: ['testing', 'pending_credentials', 'error', 'paused'],
  testing: ['connected', 'ready_for_test', 'error', 'paused'],
  connected: ['testing', 'pending_credentials', 'error', 'paused'],
  error: ['pending_credentials', 'ready_for_test', 'testing', 'paused'],
  paused: ['pending_credentials', 'ready_for_test', 'testing', 'connected'],
};

export function assertFiscalProviderConnection(connection: FiscalProviderConnection): void {
  if (
    !connection.id.trim() ||
    !connection.businessId.trim() ||
    !connection.issuerRut.trim() ||
    !connection.providerKey.trim()
  ) {
    throw new Error('Fiscal provider connection identity fields are required.');
  }
  if (!Number.isSafeInteger(connection.revision) || connection.revision < 0) {
    throw new Error('Fiscal provider connection revision must be a non-negative safe integer.');
  }
  if (connection.enabledDocumentTypes.length === 0) {
    throw new Error('Fiscal provider connection must enable at least one DTE type.');
  }
  if (new Set(connection.enabledDocumentTypes).size !== connection.enabledDocumentTypes.length) {
    throw new Error('Fiscal provider connection DTE types must be unique.');
  }
  if (
    connection.credentialRef !== undefined &&
    (connection.credentialRef.includes('Bearer ') || connection.credentialRef.length > 512)
  ) {
    throw new Error('Fiscal credentialRef must be an opaque reference, not raw credential material.');
  }
}

export function fiscalConnectionCanPerformExternalOperation(
  connection: FiscalProviderConnection,
  runtimeEnvironment: FiscalProviderEnvironment,
  documentType: ChileDteType,
): boolean {
  if (connection.environment !== runtimeEnvironment) return false;
  if (!connection.enabledDocumentTypes.includes(documentType)) return false;
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

export function transitionFiscalProviderConnection(
  connection: FiscalProviderConnection,
  next: FiscalProviderConnectionStatus,
  occurredAt: string,
): FiscalProviderConnection {
  assertFiscalProviderConnection(connection);
  if (connection.status === next) return connection;
  if (!TRANSITIONS[connection.status].includes(next)) {
    throw new Error(`Invalid fiscal provider connection transition: ${connection.status} -> ${next}`);
  }
  if (
    (next === 'ready_for_test' || next === 'testing' || next === 'connected') &&
    !connection.credentialRef?.trim()
  ) {
    throw new Error(`Fiscal provider connection cannot enter ${next} without credentialRef.`);
  }
  const updated = {
    ...connection,
    status: next,
    revision: connection.revision + 1,
    updatedAt: occurredAt,
  };
  assertFiscalProviderConnection(updated);
  return updated;
}

export function provisionFiscalCredentialReference(
  connection: FiscalProviderConnection,
  input: { credentialRef: string; occurredAt: string },
): FiscalProviderConnection {
  if (connection.status !== 'pending_credentials' && connection.status !== 'error') {
    throw new Error(`Fiscal credentials cannot be provisioned from ${connection.status}.`);
  }
  if (!input.credentialRef.trim() || input.credentialRef.includes('Bearer ')) {
    throw new Error('Fiscal credential reference must be a non-empty opaque reference.');
  }
  const updated: FiscalProviderConnection = {
    ...connection,
    credentialRef: input.credentialRef,
    status: 'ready_for_test',
    revision: connection.revision + 1,
    updatedAt: input.occurredAt,
  };
  assertFiscalProviderConnection(updated);
  return updated;
}

export function markFiscalConnectionVerified(
  connection: FiscalProviderConnection,
  occurredAt: string,
): FiscalProviderConnection {
  if (connection.status !== 'testing' && connection.status !== 'connected') {
    throw new Error('Only testing/connected fiscal provider connection can be verification-stamped.');
  }
  return {
    ...connection,
    lastVerifiedAt: occurredAt,
    revision: connection.revision + 1,
    updatedAt: occurredAt,
  };
}
