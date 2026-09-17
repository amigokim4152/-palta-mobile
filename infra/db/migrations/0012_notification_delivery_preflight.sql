-- PALTA NOTIFICATION DELIVERY PREFLIGHT
-- STATUS: DRAFT / NOT APPLIED
-- Date: 2026-09-17
--
-- Notification candidates are policy decisions, not direct provider calls.
-- This table is the durable queue boundary after recipient/preferences/quiet-hours
-- evaluation. APNs/FCM/OneSignal/etc. remain replaceable provider adapters.

create table if not exists notification_delivery (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null,
  category text not null check (category in (
    'message', 'care_state', 'deadline', 'safety', 'local_change', 'content'
  )),
  dedupe_key text not null check (length(trim(dedupe_key)) between 1 and 300),
  envelope jsonb not null,
  not_before timestamptz,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'failed', 'cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  processing_token uuid,
  processing_started_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (recipient_user_id, dedupe_key)
);

create index if not exists notification_delivery_ready_idx
  on notification_delivery(not_before, created_at)
  where status in ('queued', 'failed');

create index if not exists notification_delivery_processing_idx
  on notification_delivery(processing_started_at)
  where status = 'processing';

-- Internal orchestration only: no direct anon/authenticated write grants.
-- `envelope` is presentation/delivery data, not canonical Message/Order/etc data.
-- Message body preview is omitted by default and may be added only by an explicit
-- per-user/privacy-aware presentation policy.
