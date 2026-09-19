export type CommunityOutboxStatus =
  | 'pending'
  | 'processing'
  | 'published'
  | 'retryable_error'
  | 'dead_letter';

export const COMMUNITY_OUTBOX_MAX_ATTEMPTS = 8;
export const COMMUNITY_OUTBOX_LEASE_MS = 2 * 60 * 1000;
const COMMUNITY_OUTBOX_RETRY_BASE_MS = 30 * 1000;
const COMMUNITY_OUTBOX_RETRY_CAP_MS = 30 * 60 * 1000;

function parseTime(value?: string): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function canClaimCommunityOutbox(input: {
  status: CommunityOutboxStatus;
  now: Date;
  nextAttemptAt?: string;
  leaseExpiresAt?: string;
}): boolean {
  if (input.status === 'published' || input.status === 'dead_letter') return false;

  const nowMs = input.now.getTime();
  if (input.status === 'processing') {
    const leaseExpiresAt = parseTime(input.leaseExpiresAt);
    return leaseExpiresAt !== null && leaseExpiresAt <= nowMs;
  }

  const nextAttemptAt = parseTime(input.nextAttemptAt);
  return nextAttemptAt === null || nextAttemptAt <= nowMs;
}

export function communityOutboxLeaseExpiresAt(now: Date): string {
  return new Date(now.getTime() + COMMUNITY_OUTBOX_LEASE_MS).toISOString();
}

export function communityOutboxRetryDelayMs(attemptNumber: number): number {
  const safeAttempt = Math.max(1, Math.floor(attemptNumber));
  return Math.min(
    COMMUNITY_OUTBOX_RETRY_BASE_MS * 2 ** (safeAttempt - 1),
    COMMUNITY_OUTBOX_RETRY_CAP_MS,
  );
}

export type CommunityOutboxFailureDecision = {
  status: 'retryable_error' | 'dead_letter';
  attempts: number;
  nextAttemptAt?: string;
};

export function decideCommunityOutboxFailure(input: {
  attemptsBeforeFailure: number;
  retryable: boolean;
  now: Date;
}): CommunityOutboxFailureDecision {
  const attempts = Math.max(0, Math.floor(input.attemptsBeforeFailure)) + 1;
  if (!input.retryable || attempts >= COMMUNITY_OUTBOX_MAX_ATTEMPTS) {
    return { status: 'dead_letter', attempts };
  }

  return {
    status: 'retryable_error',
    attempts,
    nextAttemptAt: new Date(
      input.now.getTime() + communityOutboxRetryDelayMs(attempts),
    ).toISOString(),
  };
}
