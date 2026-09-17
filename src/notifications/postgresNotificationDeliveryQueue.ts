import type { DatabasePort } from '../ports/databasePort.js';
import type { NotificationDeliveryQueuePort } from './notificationCandidateConsumer.js';

export class PostgresNotificationDeliveryQueue
  implements NotificationDeliveryQueuePort {
  constructor(private readonly db: DatabasePort) {}

  async enqueueIfAbsent(input: Parameters<NotificationDeliveryQueuePort['enqueueIfAbsent']>[0]): Promise<{ enqueued: boolean }> {
    const result = await this.db.query(
      `insert into notification_delivery (
         recipient_user_id, category, dedupe_key, envelope, not_before,
         status, created_at, updated_at
       ) values (
         $1::uuid, $2, $3, $4::jsonb, $5::timestamptz,
         'queued', now(), now()
       )
       on conflict (recipient_user_id, dedupe_key) do nothing
       returning id`,
      [
        input.recipientUserId,
        input.envelope.category,
        input.dedupeKey,
        JSON.stringify(input.envelope),
        input.notBefore ?? null,
      ],
    );
    return { enqueued: result.rows.length === 1 };
  }
}
