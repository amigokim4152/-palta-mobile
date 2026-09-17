export type ProviderNotificationStatus =
  | 'received'
  | 'verified'
  | 'rejected'
  | 'processing'
  | 'processed'
  | 'retryable_error'
  | 'dead_letter';

export type ProviderNotificationInboxItem = {
  id: string;
  providerKey: string;
  providerEventId: string;
  providerResourceReference: string;
  payloadHash: string;
  signatureVerified: boolean;
  status: ProviderNotificationStatus;
  receivedAt: string;
  updatedAt: string;
  attempts: number;
  providerEventType?: string;
  requestId?: string;
  processedAt?: string;
  nextAttemptAt?: string;
  lastErrorCode?: string;
};

export function createProviderNotificationInboxItem(input: {
  id: string;
  providerKey: string;
  providerEventId: string;
  providerResourceReference: string;
  payloadHash: string;
  signatureVerified: boolean;
  receivedAt: string;
  providerEventType?: string;
  requestId?: string;
}): ProviderNotificationInboxItem {
  if (
    !input.id.trim() ||
    !input.providerKey.trim() ||
    !input.providerEventId.trim() ||
    !input.providerResourceReference.trim() ||
    !input.payloadHash.trim()
  ) {
    throw new Error('Provider notification identity and payload hash are required.');
  }

  const item: ProviderNotificationInboxItem = {
    id: input.id,
    providerKey: input.providerKey,
    providerEventId: input.providerEventId,
    providerResourceReference: input.providerResourceReference,
    payloadHash: input.payloadHash,
    signatureVerified: input.signatureVerified,
    status: input.signatureVerified ? 'verified' : 'rejected',
    receivedAt: input.receivedAt,
    updatedAt: input.receivedAt,
    attempts: 0,
  };
  if (input.providerEventType !== undefined) item.providerEventType = input.providerEventType;
  if (input.requestId !== undefined) item.requestId = input.requestId;
  return item;
}

export function markProviderNotificationProcessing(
  item: ProviderNotificationInboxItem,
  occurredAt: string,
): ProviderNotificationInboxItem {
  if (!item.signatureVerified) {
    throw new Error('Unverified provider notification must never mutate payment state.');
  }
  if (item.status !== 'verified' && item.status !== 'retryable_error') {
    throw new Error(`Provider notification cannot enter processing from ${item.status}.`);
  }
  const {
    nextAttemptAt: _nextAttemptAt,
    lastErrorCode: _lastErrorCode,
    ...rest
  } = item;
  return {
    ...rest,
    status: 'processing',
    attempts: item.attempts + 1,
    updatedAt: occurredAt,
  };
}

export function markProviderNotificationProcessed(
  item: ProviderNotificationInboxItem,
  occurredAt: string,
): ProviderNotificationInboxItem {
  if (item.status !== 'processing') {
    throw new Error('Only a processing provider notification can be completed.');
  }
  return {
    ...item,
    status: 'processed',
    processedAt: occurredAt,
    updatedAt: occurredAt,
  };
}

export function markProviderNotificationRetryable(
  item: ProviderNotificationInboxItem,
  occurredAt: string,
  nextAttemptAt: string,
  errorCode: string,
): ProviderNotificationInboxItem {
  if (item.status !== 'processing') {
    throw new Error('Only a processing provider notification can become retryable.');
  }
  return {
    ...item,
    status: 'retryable_error',
    updatedAt: occurredAt,
    nextAttemptAt,
    lastErrorCode: errorCode,
  };
}

/**
 * Webhook/callback data is a wake-up signal, not canonical payment truth.
 * After signature verification and durable inbox insertion, the worker should
 * query the provider through PaymentPort.getStatus/reconciliation and only then
 * transition the canonical PaymentIntent.
 */
export const PROVIDER_NOTIFICATION_IS_SIGNAL_NOT_TRUTH = true as const;
