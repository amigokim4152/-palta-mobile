export type WebhookVerificationInput = {
  providerKey: string;
  rawBody: string;
  headers: Record<string, string | undefined>;
  receivedAtEpochMs: number;
};

export type WebhookVerificationResult = {
  valid: boolean;
  providerEventId?: string;
  reason?: 'invalid_signature' | 'expired' | 'malformed' | 'duplicate';
};

export interface WebhookVerifier {
  verify(
    input: WebhookVerificationInput,
  ): Promise<WebhookVerificationResult>;
}

export class ReplayGuard {
  private readonly seen = new Map<string, number>();

  constructor(private readonly ttlMs: number) {}

  accept(eventId: string, nowEpochMs: number): boolean {
    this.purge(nowEpochMs);
    if (this.seen.has(eventId)) return false;
    this.seen.set(eventId, nowEpochMs);
    return true;
  }

  private purge(nowEpochMs: number): void {
    for (const [eventId, seenAt] of this.seen) {
      if (nowEpochMs - seenAt > this.ttlMs) {
        this.seen.delete(eventId);
      }
    }
  }
}
