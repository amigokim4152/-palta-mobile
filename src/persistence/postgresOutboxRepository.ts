import type {
  CommerceOutboxEvent,
  OutboxEventStatus,
} from '../commerce/outbox.js';
import {
  assertOutboxClaimRequest,
  assertOutboxEventClaimRequest,
  type OutboxClaimRequest,
  type OutboxCompleteRequest,
  type OutboxDeadLetterRequest,
  type OutboxEventClaimRequest,
  type OutboxRepository,
  type OutboxRetryRequest,
} from './outboxRepository.js';
import type { SqlDatabase } from './sqlDatabase.js';

type OutboxRow = {
  id: string;
  business_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  idempotency_key: string;
  payload: unknown;
  status: OutboxEventStatus;
  attempts: number | string;
  next_attempt_at: string | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
};

type IdRow = { id: string };

const OUTBOX_COLUMNS = `
  id,
  business_id,
  aggregate_type,
  aggregate_id,
  event_type,
  idempotency_key,
  payload,
  status,
  attempts,
  next_attempt_at,
  last_error_code,
  created_at,
  updated_at
`;

function safeAttempts(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Outbox attempts is outside Palta safe-integer range.');
  }
  return parsed;
}

function payloadObject(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Outbox payload must be a JSON object.');
  }
  return value as Record<string, unknown>;
}

function aggregateType(value: string): CommerceOutboxEvent['aggregateType'] {
  if (
    value !== 'commerce_transaction' &&
    value !== 'payment_intent' &&
    value !== 'fiscal_request' &&
    value !== 'inventory'
  ) {
    throw new Error(`Unsupported Outbox aggregate type: ${value}`);
  }
  return value;
}

function rowToEvent(row: OutboxRow): CommerceOutboxEvent {
  const event: CommerceOutboxEvent = {
    id: row.id,
    businessId: row.business_id,
    aggregateType: aggregateType(row.aggregate_type),
    aggregateId: row.aggregate_id,
    eventType: row.event_type,
    idempotencyKey: row.idempotency_key,
    payload: payloadObject(row.payload),
    status: row.status,
    attempts: safeAttempts(row.attempts),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (row.next_attempt_at !== null) event.nextAttemptAt = row.next_attempt_at;
  if (row.last_error_code !== null) event.lastError = row.last_error_code;
  return event;
}

function assertWorkerIdentity(workerId: string): void {
  if (!workerId.trim()) throw new Error('workerId is required.');
}

export class PostgresOutboxRepository implements OutboxRepository {
  constructor(private readonly db: SqlDatabase) {}

  async claimBatch(request: OutboxClaimRequest): Promise<CommerceOutboxEvent[]> {
    assertOutboxClaimRequest(request);
    const result = await this.db.query<OutboxRow>(
      `with candidates as (
        select id
        from commerce_outbox
        where (
          status in ('pending', 'retryable_error')
          and (next_attempt_at is null or next_attempt_at <= $1::timestamptz)
        ) or (
          status = 'processing'
          and lease_expires_at is not null
          and lease_expires_at <= $1::timestamptz
        )
        order by created_at
        for update skip locked
        limit $4
      )
      update commerce_outbox as o set
        status = 'processing',
        attempts = o.attempts + 1,
        claimed_by = $2,
        processing_started_at = $1::timestamptz,
        lease_expires_at = $3::timestamptz,
        next_attempt_at = null,
        last_error_code = null,
        updated_at = $1::timestamptz
      from candidates
      where o.id = candidates.id
      returning ${OUTBOX_COLUMNS}`,
      [request.now, request.workerId, request.leaseExpiresAt, request.limit],
    );
    return result.rows.map(rowToEvent);
  }

  async claimEvent(
    request: OutboxEventClaimRequest,
  ): Promise<CommerceOutboxEvent | null> {
    assertOutboxEventClaimRequest(request);
    const result = await this.db.query<OutboxRow>(
      `update commerce_outbox set
        status = 'processing',
        attempts = attempts + 1,
        claimed_by = $2,
        processing_started_at = $3::timestamptz,
        lease_expires_at = $4::timestamptz,
        next_attempt_at = null,
        last_error_code = null,
        updated_at = $3::timestamptz
      where id = $1
        and (
          (
            status in ('pending', 'retryable_error')
            and (next_attempt_at is null or next_attempt_at <= $3::timestamptz)
          )
          or (
            status = 'processing'
            and lease_expires_at is not null
            and lease_expires_at <= $3::timestamptz
          )
        )
      returning ${OUTBOX_COLUMNS}`,
      [request.eventId, request.workerId, request.now, request.leaseExpiresAt],
    );
    const row = result.rows[0];
    return row ? rowToEvent(row) : null;
  }

  async markDelivered(request: OutboxCompleteRequest): Promise<boolean> {
    assertWorkerIdentity(request.workerId);
    const result = await this.db.query<IdRow>(
      `update commerce_outbox set
        status = 'delivered',
        claimed_by = null,
        processing_started_at = null,
        lease_expires_at = null,
        next_attempt_at = null,
        last_error_code = null,
        updated_at = $3::timestamptz
      where id = $1 and status = 'processing' and claimed_by = $2
      returning id`,
      [request.eventId, request.workerId, request.occurredAt],
    );
    return result.rowCount === 1;
  }

  async markRetryable(request: OutboxRetryRequest): Promise<boolean> {
    assertWorkerIdentity(request.workerId);
    if (!request.errorCode.trim()) throw new Error('errorCode is required.');
    const result = await this.db.query<IdRow>(
      `update commerce_outbox set
        status = 'retryable_error',
        claimed_by = null,
        processing_started_at = null,
        lease_expires_at = null,
        next_attempt_at = $4::timestamptz,
        last_error_code = $5,
        updated_at = $3::timestamptz
      where id = $1 and status = 'processing' and claimed_by = $2
      returning id`,
      [
        request.eventId,
        request.workerId,
        request.occurredAt,
        request.nextAttemptAt,
        request.errorCode,
      ],
    );
    return result.rowCount === 1;
  }

  async markDeadLetter(request: OutboxDeadLetterRequest): Promise<boolean> {
    assertWorkerIdentity(request.workerId);
    if (!request.errorCode.trim()) throw new Error('errorCode is required.');
    const result = await this.db.query<IdRow>(
      `update commerce_outbox set
        status = 'dead_letter',
        claimed_by = null,
        processing_started_at = null,
        lease_expires_at = null,
        next_attempt_at = null,
        last_error_code = $4,
        updated_at = $3::timestamptz
      where id = $1 and status = 'processing' and claimed_by = $2
      returning id`,
      [request.eventId, request.workerId, request.occurredAt, request.errorCode],
    );
    return result.rowCount === 1;
  }
}
