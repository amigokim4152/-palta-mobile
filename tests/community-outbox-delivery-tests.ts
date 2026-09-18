import {
  COMMUNITY_OUTBOX_MAX_ATTEMPTS,
  canClaimCommunityOutbox,
  communityOutboxLeaseExpiresAt,
  communityOutboxRetryDelayMs,
  decideCommunityOutboxFailure,
} from '../src/community/communityOutboxDelivery.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const now = new Date('2026-09-18T18:00:00-03:00');

assert(
  canClaimCommunityOutbox({ status: 'pending', now }),
  'Fresh pending Community outbox rows should be claimable.',
);
assert(
  !canClaimCommunityOutbox({
    status: 'retryable_error',
    now,
    nextAttemptAt: '2026-09-18T18:05:00-03:00',
  }),
  'Retryable rows must wait until nextAttemptAt.',
);
assert(
  canClaimCommunityOutbox({
    status: 'retryable_error',
    now,
    nextAttemptAt: '2026-09-18T17:59:00-03:00',
  }),
  'Retryable rows become claimable after nextAttemptAt.',
);
assert(
  !canClaimCommunityOutbox({
    status: 'processing',
    now,
    leaseExpiresAt: '2026-09-18T18:01:00-03:00',
  }),
  'A live processing lease must not be stolen.',
);
assert(
  canClaimCommunityOutbox({
    status: 'processing',
    now,
    leaseExpiresAt: '2026-09-18T17:59:00-03:00',
  }),
  'An expired processing lease must be recoverable.',
);
assert(
  !canClaimCommunityOutbox({ status: 'published', now }),
  'Published outbox rows must never be reclaimed.',
);
assert(
  !canClaimCommunityOutbox({ status: 'dead_letter', now }),
  'Dead-letter rows must require explicit operator recovery.',
);

assert(
  communityOutboxLeaseExpiresAt(now) === '2026-09-18T21:02:00.000Z',
  'Community outbox leases should last two minutes.',
);
assert(
  communityOutboxRetryDelayMs(1) === 30_000,
  'First retry should use the 30 second base delay.',
);
assert(
  communityOutboxRetryDelayMs(2) === 60_000,
  'Retry delay should back off exponentially.',
);
assert(
  communityOutboxRetryDelayMs(99) === 30 * 60 * 1000,
  'Retry delay must be capped at 30 minutes.',
);

const firstFailure = decideCommunityOutboxFailure({
  attemptsBeforeFailure: 0,
  retryable: true,
  now,
});
assert(firstFailure.status === 'retryable_error', 'Transient first failures should retry.');
assert(firstFailure.attempts === 1, 'A failed delivery increments attempts exactly once.');
assert(
  firstFailure.nextAttemptAt === '2026-09-18T21:00:30.000Z',
  'First retry should be scheduled 30 seconds later.',
);

const terminalTransientFailure = decideCommunityOutboxFailure({
  attemptsBeforeFailure: COMMUNITY_OUTBOX_MAX_ATTEMPTS - 1,
  retryable: true,
  now,
});
assert(
  terminalTransientFailure.status === 'dead_letter',
  'The max-attempt boundary must dead-letter repeated transient failures.',
);
assert(
  terminalTransientFailure.nextAttemptAt === undefined,
  'Dead-letter rows must not retain an automatic next attempt.',
);

const permanentFailure = decideCommunityOutboxFailure({
  attemptsBeforeFailure: 0,
  retryable: false,
  now,
});
assert(permanentFailure.status === 'dead_letter', 'Permanent failures must dead-letter immediately.');

console.log('PASS: community outbox delivery tests');
