-- PALTA OUTBOX LEASING PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- A worker may die after claiming an Outbox row. A plain `processing` state can
-- strand work forever. Lease fields let another worker reclaim expired work.

alter table public.commerce_outbox
  add column if not exists claimed_by text,
  add column if not exists processing_started_at timestamptz,
  add column if not exists lease_expires_at timestamptz;

create index if not exists commerce_outbox_claim_idx
  on public.commerce_outbox(status, next_attempt_at, lease_expires_at, created_at)
  where status in ('pending', 'retryable_error', 'processing');

-- Invariants enforced by repository/worker contract:
-- 1. Claim uses SELECT ... FOR UPDATE SKIP LOCKED in a DB transaction.
-- 2. pending/retryable rows are claimable when next_attempt_at is due.
-- 3. processing rows are reclaimable only when lease_expires_at <= now().
-- 4. Delivery/retry/dead-letter update requires matching claimed_by so a stale
--    worker cannot overwrite the decision of a worker that reclaimed the lease.
-- 5. Claim/reclaim increments attempts.
