import type { PaltaNotificationEnvelope } from './notificationEnvelope.js';

export interface ClaimedNotificationDelivery {
  deliveryId: string;
  recipientUserId: string;
  dedupeKey: string;
  envelope: PaltaNotificationEnvelope;
  attemptCount: number;
  processingToken: string;
}

export interface NotificationDeliveryStorePort {
  claimBatch(input: {
    processingToken: string;
    now: string;
    staleBefore: string;
    limit: number;
  }): Promise<ClaimedNotificationDelivery[]>;

  markSent(input: {
    deliveryId: string;
    processingToken: string;
    sentAt: string;
  }): Promise<boolean>;

  markRetry(input: {
    deliveryId: string;
    processingToken: string;
    retryAt: string;
    error: string;
  }): Promise<boolean>;

  markCancelled(input: {
    deliveryId: string;
    processingToken: string;
    reason: string;
  }): Promise<boolean>;
}

export type NotificationProviderResult =
  | { disposition: 'sent' }
  | { disposition: 'retry'; retryAt: string; error: string }
  | { disposition: 'drop'; reason: string };

/**
 * Provider adapter resolves registered devices/tokens for the user and performs
 * the actual APNs/FCM/OneSignal/etc. operation. Notification Core never stores
 * provider tokens inside Message/Care records.
 */
export interface NotificationProviderAdapter {
  send(input: {
    recipientUserId: string;
    envelope: PaltaNotificationEnvelope;
  }): Promise<NotificationProviderResult>;
}

export interface NotificationDeliveryWorkerRuntime {
  nextProcessingToken(): string;
  now(): string;
  staleBefore(nowIso: string): string;
}

export interface NotificationDeliveryBatchResult {
  claimed: number;
  sent: number;
  retried: number;
  dropped: number;
  lostLease: number;
}

export class NotificationDeliveryWorker {
  constructor(
    private readonly store: NotificationDeliveryStorePort,
    private readonly provider: NotificationProviderAdapter,
    private readonly runtime: NotificationDeliveryWorkerRuntime,
  ) {}

  async runBatch(limit = 50): Promise<NotificationDeliveryBatchResult> {
    const now = this.runtime.now();
    const processingToken = this.runtime.nextProcessingToken();
    const claimed = await this.store.claimBatch({
      processingToken,
      now,
      staleBefore: this.runtime.staleBefore(now),
      limit: Math.min(200, Math.max(1, Math.trunc(limit))),
    });

    const result: NotificationDeliveryBatchResult = {
      claimed: claimed.length,
      sent: 0,
      retried: 0,
      dropped: 0,
      lostLease: 0,
    };

    for (const delivery of claimed) {
      let providerResult: NotificationProviderResult;
      try {
        providerResult = await this.provider.send({
          recipientUserId: delivery.recipientUserId,
          envelope: delivery.envelope,
        });
      } catch (error) {
        providerResult = {
          disposition: 'retry',
          retryAt: new Date(Date.parse(this.runtime.now()) + 60_000).toISOString(),
          error: error instanceof Error ? error.message : String(error),
        };
      }

      if (providerResult.disposition === 'sent') {
        const marked = await this.store.markSent({
          deliveryId: delivery.deliveryId,
          processingToken: delivery.processingToken,
          sentAt: this.runtime.now(),
        });
        if (marked) result.sent += 1;
        else result.lostLease += 1;
        continue;
      }

      if (providerResult.disposition === 'retry') {
        const marked = await this.store.markRetry({
          deliveryId: delivery.deliveryId,
          processingToken: delivery.processingToken,
          retryAt: providerResult.retryAt,
          error: providerResult.error,
        });
        if (marked) result.retried += 1;
        else result.lostLease += 1;
        continue;
      }

      const marked = await this.store.markCancelled({
        deliveryId: delivery.deliveryId,
        processingToken: delivery.processingToken,
        reason: providerResult.reason,
      });
      if (marked) result.dropped += 1;
      else result.lostLease += 1;
    }

    return result;
  }
}

export function defaultNotificationDeliveryWorkerRuntime(input: {
  nextProcessingToken: () => string;
  leaseMs?: number;
}): NotificationDeliveryWorkerRuntime {
  const leaseMs = Math.max(30_000, input.leaseMs ?? 5 * 60_000);
  return {
    nextProcessingToken: input.nextProcessingToken,
    now: () => new Date().toISOString(),
    staleBefore: (nowIso) =>
      new Date(Date.parse(nowIso) - leaseMs).toISOString(),
  };
}
