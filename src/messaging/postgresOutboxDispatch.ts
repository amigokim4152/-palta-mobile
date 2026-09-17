import type { DatabasePort } from '../ports/databasePort.js';
import type { OutboxEvent } from './contracts.js';
import type {
  ClaimedOutboxEvent,
  MessageOutboxDispatchPort,
} from './outboxDispatchPort.js';

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mapClaimed(row: Record<string, unknown>): ClaimedOutboxEvent {
  const publishedAt = typeof row.published_at === 'string' && row.published_at.length > 0
    ? row.published_at
    : undefined;
  const base: OutboxEvent = {
    outboxEventId: String(row.id),
    aggregateType: String(row.aggregate_type) as OutboxEvent['aggregateType'],
    aggregateId: String(row.aggregate_id),
    eventType: String(row.event_type),
    payload: asObject(row.payload),
    createdAt: String(row.created_at),
    ...(publishedAt !== undefined ? { publishedAt } : {}),
  };
  return {
    ...base,
    processingToken: String(row.processing_token),
    publishAttemptCount: Number(row.publish_attempt_count || 0),
  };
}

export class PostgresMessageOutboxDispatch implements MessageOutboxDispatchPort {
  constructor(private readonly db: DatabasePort) {}

  async claimBatch(input: {
    processingToken: string;
    now: string;
    staleBefore: string;
    limit: number;
  }): Promise<ClaimedOutboxEvent[]> {
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    return this.db.transaction(async (tx) => {
      const result = await tx.query(
        `with claimable as (
           select id
             from msg_outbox
            where published_at is null
              and (
                processing_token is null
                or processing_started_at is null
                or processing_started_at < $2::timestamptz
              )
            order by created_at asc
            for update skip locked
            limit $3
         )
         update msg_outbox o
            set processing_token = $1::uuid,
                processing_started_at = $4::timestamptz,
                publish_attempt_count = o.publish_attempt_count + 1,
                last_publish_error = null
           from claimable c
          where o.id = c.id
        returning o.id, o.aggregate_type, o.aggregate_id, o.event_type,
                  o.payload, o.created_at, o.published_at,
                  o.processing_token, o.publish_attempt_count`,
        [input.processingToken, input.staleBefore, limit, input.now],
      );
      return result.rows.map(mapClaimed);
    });
  }

  async markPublished(input: {
    outboxEventId: string;
    processingToken: string;
    publishedAt: string;
  }): Promise<boolean> {
    const result = await this.db.query(
      `update msg_outbox
          set published_at = $3::timestamptz,
              processing_token = null,
              processing_started_at = null,
              last_publish_error = null
        where id = $1::uuid
          and processing_token = $2::uuid
          and published_at is null
      returning id`,
      [input.outboxEventId, input.processingToken, input.publishedAt],
    );
    return result.rows.length === 1;
  }

  async markFailed(input: {
    outboxEventId: string;
    processingToken: string;
    error: string;
  }): Promise<boolean> {
    const result = await this.db.query(
      `update msg_outbox
          set processing_token = null,
              processing_started_at = null,
              last_publish_error = left($3, 2000)
        where id = $1::uuid
          and processing_token = $2::uuid
          and published_at is null
      returning id`,
      [input.outboxEventId, input.processingToken, input.error],
    );
    return result.rows.length === 1;
  }
}
