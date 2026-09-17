import type { DatabasePort } from '../ports/databasePort.js';
import type { PaltaNotificationEnvelope } from './notificationEnvelope.js';
import type {
  ClaimedNotificationDelivery,
  NotificationDeliveryStorePort,
} from './notificationDeliveryWorker.js';

function asEnvelope(value: unknown): PaltaNotificationEnvelope {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Notification delivery row contains invalid envelope JSON.');
  }
  const object = parsed as Record<string, unknown>;
  if (
    typeof object.id !== 'string' ||
    typeof object.category !== 'string' ||
    typeof object.title !== 'string' ||
    typeof object.occurredAt !== 'string'
  ) {
    throw new Error('Notification delivery row contains incomplete envelope.');
  }
  return object as unknown as PaltaNotificationEnvelope;
}

function mapClaimed(row: Record<string, unknown>): ClaimedNotificationDelivery {
  return {
    deliveryId: String(row.id),
    recipientUserId: String(row.recipient_user_id),
    dedupeKey: String(row.dedupe_key),
    envelope: asEnvelope(row.envelope),
    attemptCount: Number(row.attempt_count ?? 0),
    processingToken: String(row.processing_token),
  };
}

export class PostgresNotificationDeliveryStore
  implements NotificationDeliveryStorePort {
  constructor(private readonly db: DatabasePort) {}

  async claimBatch(input: {
    processingToken: string;
    now: string;
    staleBefore: string;
    limit: number;
  }): Promise<ClaimedNotificationDelivery[]> {
    const limit = Math.min(200, Math.max(1, Math.trunc(input.limit)));
    return this.db.transaction(async (tx) => {
      const result = await tx.query(
        `with claimable as (
           select id
             from notification_delivery
            where (
                    status in ('queued', 'failed')
                    and (not_before is null or not_before <= $2::timestamptz)
                  )
               or (
                    status = 'processing'
                    and processing_started_at < $3::timestamptz
                  )
            order by coalesce(not_before, created_at) asc, created_at asc
            for update skip locked
            limit $4
         )
         update notification_delivery d
            set status = 'processing',
                processing_token = $1::uuid,
                processing_started_at = $2::timestamptz,
                attempt_count = d.attempt_count + 1,
                updated_at = $2::timestamptz,
                last_error = null
           from claimable c
          where d.id = c.id
        returning d.id, d.recipient_user_id, d.dedupe_key, d.envelope,
                  d.attempt_count, d.processing_token`,
        [input.processingToken, input.now, input.staleBefore, limit],
      );
      return result.rows.map(mapClaimed);
    });
  }

  async markSent(input: {
    deliveryId: string;
    processingToken: string;
    sentAt: string;
  }): Promise<boolean> {
    const result = await this.db.query(
      `update notification_delivery
          set status = 'sent',
              sent_at = $3::timestamptz,
              processing_token = null,
              processing_started_at = null,
              last_error = null,
              updated_at = $3::timestamptz
        where id = $1::uuid
          and processing_token = $2::uuid
          and status = 'processing'
      returning id`,
      [input.deliveryId, input.processingToken, input.sentAt],
    );
    return result.rows.length === 1;
  }

  async markRetry(input: {
    deliveryId: string;
    processingToken: string;
    retryAt: string;
    error: string;
  }): Promise<boolean> {
    const result = await this.db.query(
      `update notification_delivery
          set status = 'failed',
              not_before = $3::timestamptz,
              processing_token = null,
              processing_started_at = null,
              last_error = left($4, 2000),
              updated_at = now()
        where id = $1::uuid
          and processing_token = $2::uuid
          and status = 'processing'
      returning id`,
      [input.deliveryId, input.processingToken, input.retryAt, input.error],
    );
    return result.rows.length === 1;
  }

  async markCancelled(input: {
    deliveryId: string;
    processingToken: string;
    reason: string;
  }): Promise<boolean> {
    const result = await this.db.query(
      `update notification_delivery
          set status = 'cancelled',
              processing_token = null,
              processing_started_at = null,
              last_error = left($3, 2000),
              updated_at = now()
        where id = $1::uuid
          and processing_token = $2::uuid
          and status = 'processing'
      returning id`,
      [input.deliveryId, input.processingToken, input.reason],
    );
    return result.rows.length === 1;
  }
}
