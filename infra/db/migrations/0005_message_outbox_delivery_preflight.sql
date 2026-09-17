-- PALTA MESSAGE OUTBOX DELIVERY PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- Claim-and-publish model:
-- 1. Worker claims unpublished rows with FOR UPDATE SKIP LOCKED and commits the lease.
-- 2. Worker publishes to shared EventBus outside the DB transaction.
-- 3. Worker marks published only after EventBus publish succeeds.
-- 4. A stale lease may be reclaimed after its lease window.
--
-- A crash after EventBus publish but before mark-published may cause a duplicate
-- event. Consumers therefore dedupe by the immutable outbox/event ID. This
-- intentionally prefers at-least-once delivery over silently losing messages.

alter table msg_outbox
  add column if not exists publish_attempt_count integer not null default 0,
  add column if not exists processing_token uuid,
  add column if not exists processing_started_at timestamptz,
  add column if not exists last_publish_error text;

create index if not exists msg_outbox_claimable_idx
  on msg_outbox(created_at)
  where published_at is null;

create index if not exists msg_outbox_stale_lease_idx
  on msg_outbox(processing_started_at)
  where published_at is null and processing_token is not null;

-- processing_token is operational only. It is never exposed to mobile clients
-- or included in the PaltaEvent payload.
