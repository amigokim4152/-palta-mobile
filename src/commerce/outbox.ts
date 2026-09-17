export type OutboxEventStatus =
  | 'pending'
  | 'processing'
  | 'delivered'
  | 'retryable_error'
  | 'dead_letter';

export type CommerceOutboxEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  businessId: string;
  aggregateType:
    | 'commerce_transaction'
    | 'payment_intent'
    | 'fiscal_request'
    | 'fiscal_execution'
    | 'inventory';
  aggregateId: string;
  eventType: string;
  idempotencyKey: string;
  payload: TPayload;
  status: OutboxEventStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  nextAttemptAt?: string;
  lastError?: string;
};

export function createOutboxEvent<TPayload extends Record<string, unknown>>(input: {
  id: string;
  businessId: string;
  aggregateType: CommerceOutboxEvent['aggregateType'];
  aggregateId: string;
  eventType: string;
  idempotencyKey: string;
  payload: TPayload;
  createdAt: string;
}): CommerceOutboxEvent<TPayload> {
  if (!input.id.trim() || !input.businessId.trim() || !input.aggregateId.trim() || !input.eventType.trim() || !input.idempotencyKey.trim()) {
    throw new Error('Outbox event identity fields are required.');
  }
  return {
    ...input,
    payload: { ...input.payload },
    status: 'pending',
    attempts: 0,
    updatedAt: input.createdAt,
  };
}

export function markOutboxProcessing<TPayload extends Record<string, unknown>>(
  event: CommerceOutboxEvent<TPayload>,
  occurredAt: string,
): CommerceOutboxEvent<TPayload> {
  if (event.status !== 'pending' && event.status !== 'retryable_error') {
    throw new Error(`Outbox event cannot enter processing from ${event.status}.`);
  }
  const {
    nextAttemptAt: _nextAttemptAt,
    lastError: _lastError,
    ...rest
  } = event;
  return {
    ...rest,
    status: 'processing',
    attempts: event.attempts + 1,
    updatedAt: occurredAt,
  };
}

export function markOutboxDelivered<TPayload extends Record<string, unknown>>(
  event: CommerceOutboxEvent<TPayload>,
  occurredAt: string,
): CommerceOutboxEvent<TPayload> {
  if (event.status !== 'processing') throw new Error('Only a processing event can be delivered.');
  return { ...event, status: 'delivered', updatedAt: occurredAt };
}

export function markOutboxRetryable<TPayload extends Record<string, unknown>>(
  event: CommerceOutboxEvent<TPayload>,
  occurredAt: string,
  nextAttemptAt: string,
  error: string,
): CommerceOutboxEvent<TPayload> {
  if (event.status !== 'processing') throw new Error('Only a processing event can become retryable.');
  return {
    ...event,
    status: 'retryable_error',
    updatedAt: occurredAt,
    nextAttemptAt,
    lastError: error,
  };
}

export function markOutboxDeadLetter<TPayload extends Record<string, unknown>>(
  event: CommerceOutboxEvent<TPayload>,
  occurredAt: string,
  error: string,
): CommerceOutboxEvent<TPayload> {
  if (event.status !== 'processing' && event.status !== 'retryable_error') {
    throw new Error('Only a failed processing event can enter dead-letter.');
  }
  return {
    ...event,
    status: 'dead_letter',
    updatedAt: occurredAt,
    lastError: error,
  };
}
